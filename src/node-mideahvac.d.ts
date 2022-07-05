declare module 'node-mideahvac' {
    export function createAppliance(options: CreateApplianceOptions): AC;

    export interface AC {
        getStatus(retry?: number): Promise<Status>;
        setStatus(options: SetStatusOptions, retry?: number): Promise<Status>;
    }

    export interface CreateApplianceOptions {
        communicationMethod: string;
        host: string;
        id: string;
        key: string;
        token: string;
    }

    export interface Status {
        powerOn: boolean;
        indoorTemperature: number;
        temperatureSetpoint: number;
        mode: Mode;
    }

    export interface Mode {
        value: number;
    }

    export interface SetStatusOptions {
        fanSpeed?: string;
        leftrightFan?: boolean;
        mode?: string;
        powerOn?: boolean;
        temperatureSetpoint?: number;
        updownFan?: boolean;
    }
}