/**
 * Web Bluetooth control of a smart trainer (Wahoo KICKR etc.). Lets the app put
 * the trainer in ERG mode and command a target wattage per workout block, plus
 * read live power / cadence back, so you can ride the workout in-app instead of
 * bouncing it through a Garmin Edge.
 *
 * Two control schemes are supported, tried in order:
 *   1. FTMS (Fitness Machine Service) — the open standard. Newer KICKR firmware
 *      and most modern trainers expose it.
 *   2. Wahoo proprietary — older KICKR / KICKR CORE firmware has no FTMS. Power
 *      and cadence come from the standard Cycling Power service; ERG resistance
 *      is set with Wahoo's vendor control characteristic.
 *
 * Platform note: Web Bluetooth works in Chrome/Edge on desktop and Android. It is
 * NOT available in any iOS browser (Safari/WebKit). `isSupported()` reflects that.
 */

// FTMS UUIDs (16-bit, expanded by the browser to the full base UUID).
const FTMS_SERVICE = 0x1826;
const CHAR_CONTROL_POINT = 0x2ad9; // Fitness Machine Control Point (write + indicate)
const CHAR_INDOOR_BIKE_DATA = 0x2ad2; // Indoor Bike Data (notify)

// Standard Cycling Power service — power + cadence data, present on the KICKR.
const CYCLING_POWER_SERVICE = 0x1818;
const CHAR_CYCLING_POWER_MEASUREMENT = 0x2a63; // notify
const DEVICE_INFO_SERVICE = 0x180a;

// Wahoo proprietary trainer control (used when FTMS is absent). The control
// characteristic can live in the Cycling Power service or Wahoo's own service.
const WAHOO_SERVICE = "a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b";
const WAHOO_CONTROL_CHAR = "a026e005-0a7d-4ab3-97fa-f1500f9feb8b";
const WAHOO_UNLOCK = [0x20, 0xee, 0xfc]; // unlock before control commands
const WAHOO_SET_ERG = 0x42; // followed by uint16 LE target watts

// FTMS Control Point op codes.
const OP_REQUEST_CONTROL = 0x00;
const OP_START_RESUME = 0x07;
const OP_SET_TARGET_POWER = 0x05;

export interface TrainerData {
  power?: number; // watts
  cadence?: number; // rpm
  speed?: number; // km/h
}

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as { bluetooth?: unknown }).bluetooth;
}

/** Parse an FTMS "Indoor Bike Data" notification into the fields we care about. */
function parseIndoorBikeData(dv: DataView): TrainerData {
  const flags = dv.getUint16(0, true);
  let i = 2;
  const out: TrainerData = {};

  // Bit 0 = "More Data": when CLEAR, Instantaneous Speed (uint16, 0.01 km/h) is present.
  if ((flags & 0x0001) === 0) {
    out.speed = dv.getUint16(i, true) / 100;
    i += 2;
  }
  if (flags & 0x0002) i += 2; // Average Speed
  if (flags & 0x0004) {
    out.cadence = dv.getUint16(i, true) / 2; // 0.5 rpm resolution
    i += 2;
  }
  if (flags & 0x0008) i += 2; // Average Cadence
  if (flags & 0x0010) i += 3; // Total Distance (uint24)
  if (flags & 0x0020) i += 2; // Resistance Level
  if (flags & 0x0040) {
    out.power = dv.getInt16(i, true); // Instantaneous Power (watts)
    i += 2;
  }
  return out;
}

export class Trainer {
  private device: BluetoothDevice | null = null;
  private control: BluetoothRemoteGATTCharacteristic | null = null;
  private mode: "ftms" | "wahoo" | "none" = "none";

  // Cadence is derived from successive crank-revolution samples (Cycling Power).
  private prevCrankRevs: number | null = null;
  private prevCrankTime: number | null = null;
  private lastCadence: number | undefined;

  onData: ((d: TrainerData) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  get name(): string {
    return this.device?.name || "Trainer";
  }

  get connected(): boolean {
    return !!this.device?.gatt?.connected;
  }

  /** Pair, connect, and set up data + control via FTMS or the Wahoo fallback. */
  async connect(): Promise<void> {
    if (!isSupported()) {
      throw new Error("Web Bluetooth isn't available in this browser. Use Chrome or Edge on a computer or Android.");
    }
    const bt = (navigator as unknown as { bluetooth: Bluetooth }).bluetooth;
    const device = await bt.requestDevice({
      // Match on any of: FTMS, Cycling Power, or a Wahoo/KICKR name — so the
      // trainer shows up in the chooser regardless of which it advertises.
      filters: [
        { services: [FTMS_SERVICE] },
        { services: [CYCLING_POWER_SERVICE] },
        { namePrefix: "KICKR" },
        { namePrefix: "Wahoo" },
      ],
      // We may only access services listed here after connecting.
      optionalServices: [FTMS_SERVICE, CYCLING_POWER_SERVICE, DEVICE_INFO_SERVICE, WAHOO_SERVICE],
    });
    this.device = device;
    device.addEventListener("gattserverdisconnected", () => {
      this.control = null;
      this.mode = "none";
      this.onDisconnect?.();
    });

    const server = await device.gatt!.connect();

    // Prefer FTMS (the open standard) if this unit exposes it.
    if (await this.setupFtms(server)) {
      this.mode = "ftms";
      return;
    }

    // Fall back to Cycling Power data + Wahoo proprietary control.
    await this.setupCyclingPowerData(server);
    if (await this.setupWahooControl(server)) {
      this.mode = "wahoo";
      return;
    }

    // We have data but no control path — surface that clearly.
    if (!this.control) {
      throw new Error(
        "Connected, but this trainer doesn't expose a control service this app can drive. " +
        "Updating the KICKR firmware in the Wahoo app usually adds the standard (FTMS) profile."
      );
    }
  }

  /** Try the FTMS path. Returns true if the service is present and set up. */
  private async setupFtms(server: BluetoothRemoteGATTServer): Promise<boolean> {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(FTMS_SERVICE);
    } catch {
      return false; // no FTMS on this trainer
    }
    this.control = await service.getCharacteristic(CHAR_CONTROL_POINT);
    await this.control.startNotifications().catch(() => {});

    try {
      const bikeData = await service.getCharacteristic(CHAR_INDOOR_BIKE_DATA);
      bikeData.addEventListener("characteristicvaluechanged", (e) => {
        const dv = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (dv) this.onData?.(parseIndoorBikeData(dv));
      });
      await bikeData.startNotifications();
    } catch {
      // Live data is a nice-to-have; control still works without it.
    }

    await this.writeControl([OP_REQUEST_CONTROL]);
    await this.writeControl([OP_START_RESUME]);
    return true;
  }

  /** Subscribe to the standard Cycling Power Measurement for power + cadence. */
  private async setupCyclingPowerData(server: BluetoothRemoteGATTServer): Promise<void> {
    try {
      const cps = await server.getPrimaryService(CYCLING_POWER_SERVICE);
      const meas = await cps.getCharacteristic(CHAR_CYCLING_POWER_MEASUREMENT);
      meas.addEventListener("characteristicvaluechanged", (e) => {
        const dv = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (dv) this.onData?.(this.parseCyclingPower(dv));
      });
      await meas.startNotifications();
    } catch {
      // No standard power data — the tiles just stay blank.
    }
  }

  /** Find Wahoo's vendor control characteristic and unlock it for ERG commands. */
  private async setupWahooControl(server: BluetoothRemoteGATTServer): Promise<boolean> {
    for (const svc of [CYCLING_POWER_SERVICE, WAHOO_SERVICE]) {
      try {
        const service = await server.getPrimaryService(svc);
        this.control = await service.getCharacteristic(WAHOO_CONTROL_CHAR);
        await this.control.startNotifications().catch(() => {});
        await this.control.writeValue(new Uint8Array(WAHOO_UNLOCK)).catch(() => {});
        return true;
      } catch {
        // try the next service
      }
    }
    return false;
  }

  /** Parse a Cycling Power Measurement notification (power + derived cadence). */
  private parseCyclingPower(dv: DataView): TrainerData {
    const flags = dv.getUint16(0, true);
    const out: TrainerData = { power: dv.getInt16(2, true) };
    let i = 4;
    if (flags & 0x0001) i += 1; // Pedal Power Balance (uint8)
    if (flags & 0x0004) i += 2; // Accumulated Torque (uint16)
    if (flags & 0x0010) i += 6; // Wheel Revolution Data (uint32 + uint16)
    if (flags & 0x0020) {
      // Crank Revolution Data: cumulative revs + last event time (1/1024 s).
      const revs = dv.getUint16(i, true);
      const time = dv.getUint16(i + 2, true);
      if (this.prevCrankRevs != null && this.prevCrankTime != null) {
        const dRev = (revs - this.prevCrankRevs + 0x10000) % 0x10000;
        const dT = (time - this.prevCrankTime + 0x10000) % 0x10000;
        if (dT > 0) this.lastCadence = Math.round((dRev * 1024 * 60) / dT);
        else if (dRev === 0) this.lastCadence = 0; // repeated sample, no new revs
      }
      this.prevCrankRevs = revs;
      this.prevCrankTime = time;
      out.cadence = this.lastCadence;
    }
    return out;
  }

  /** Command a target wattage (ERG mode) using whichever control path is active. */
  async setTargetPower(watts: number): Promise<void> {
    if (!this.control) return;
    const w = Math.max(0, Math.round(watts));
    const buf = new ArrayBuffer(3);
    const dv = new DataView(buf);
    if (this.mode === "wahoo") {
      dv.setUint8(0, WAHOO_SET_ERG);
      dv.setUint16(1, w, true);
    } else {
      dv.setUint8(0, OP_SET_TARGET_POWER);
      dv.setInt16(1, w, true);
    }
    await this.control.writeValue(buf).catch(() => {});
  }

  async disconnect(): Promise<void> {
    try {
      this.device?.gatt?.disconnect();
    } finally {
      this.device = null;
      this.control = null;
      this.mode = "none";
      this.prevCrankRevs = null;
      this.prevCrankTime = null;
      this.lastCadence = undefined;
    }
  }

  private async writeControl(bytes: number[]): Promise<void> {
    if (!this.control) return;
    await this.control.writeValue(new Uint8Array(bytes)).catch(() => {});
  }
}
