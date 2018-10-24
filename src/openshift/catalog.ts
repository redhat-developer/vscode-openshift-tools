import { Odo, OdoImpl } from "../odo";

export class Catalog {
    private static odo: Odo = OdoImpl.getInstance();

    static listComponents(): void {
        Catalog.odo.executeInTerminal(`odo catalog list components`, process.cwd());
    }

    static listServices(): void {
        Catalog.odo.executeInTerminal(`odo catalog list services`, process.cwd());
    }
}