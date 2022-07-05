import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MideaPlatform } from './MideaPlatform';
import { Device } from './Device';
///<reference path="node-mideahvac.d.ts" />
import { createAppliance, AC, Status } from 'node-mideahvac';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MideaAccessory {

  public name = '';
  public deviceIPAddress = '';
  public deviceId = '';
  public key = '';
  public token = '';

  private service: Service;

  private ac: AC;
  private isActive = 0;
  private currentTemp = 20;
  private targetTemp = 20;
  private state = 0;

  constructor(
    private readonly platform: MideaPlatform,
    private readonly accessory: PlatformAccessory,
    device: Device,
  ) {
    const options = {
      communicationMethod: 'sk103',
      host: device.deviceIPAddress,
      id: device.deviceId,
      key: device.key,
      token: device.token,
    };

    this.ac = createAppliance(options);
    this.updateStatus();
    setInterval(() => {

      this.updateStatus();
    }, 10000);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea')
      .setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.deviceId);

    // get the HeaterCooler service if it exists, otherwise create a new HeaterCooler service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
                   || this.accessory.addService(this.platform.Service.HeaterCooler);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/HeaterCooler

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));
  }

  async updateStatus(){
    try{
      const res = await this.ac.getStatus(3);
      this.updateValues(res);

      this.platform.log.debug('result received');
    } catch (e){
      const error = (e as Error).message;
      this.platform.log.warn(error);
    }
  }

  updateValues(res: Status){
    if(res.powerOn === true) {
      this.isActive = this.platform.Characteristic.Active.ACTIVE;
    } else {
      this.isActive = this.platform.Characteristic.Active.INACTIVE;
    }

    this.currentTemp = res.indoorTemperature;
    this.targetTemp = res.temperatureSetpoint;

    if(res.mode.value === 2) {
      this.state = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    } else if (res.mode.value === 4) {
      this.state = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    } else if (this.currentTemp > this.targetTemp) {
      this.state = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
    } else {
      this.state = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }
  }

  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET Active: ', this.isActive);
    return this.isActive;
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  async setActive(value: CharacteristicValue) {
    let powerOn: boolean;
    if(value === 1) {
      powerOn = true;
    } else {
      powerOn = false;
    }
    const options = {
      powerOn: powerOn,
    };

    const res = await this.ac.setStatus(options, 3);
    this.isActive = Number(res.powerOn);
    this.platform.log.debug('Triggered SET Active: ', powerOn);
  }

  /**
   * Handle requests to get the current value of the "Target Heater-Cooler State" characteristic
   */
  async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET TargetHeaterCoolerState: ', this.state);
    return this.state;
  }

  /**
   * Handle requests to set the "Target Heater-Cooler State" characteristic
   */
  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    let mode = 'cool';
    if (value === this.platform.Characteristic.TargetHeaterCoolerState.COOL) {
      mode = 'cool';
    } else if (value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
      mode = 'heat';
    } else if (value === this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      mode = 'auto';
    }
    this.platform.log.debug(mode);

    const options = {
      mode: mode,
    };

    this.state = value as number;
    await this.ac.setStatus(options, 3);

    this.platform.log.debug('Triggered SET TargetHeaterCoolerState:', value);
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET CurrentTemperature', this.currentTemp);
    return this.currentTemp;
  }

  /**
   * Handle requests to get the current value of the "Heating Threshold Temperature characteristic
   */
  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET HeatingThresholdTemperature: ', this.targetTemp);
    return this.targetTemp;
  }

  /**
   * Handle requests to set the "HeatingThresholdTemperature characteristic
   */
  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET HeatingThresholdTemperature:', value);

    this.targetTemp = value as number;

    const options = {
      temperatureSetpoint: this.targetTemp,
    };

    this.ac.setStatus(options, 3);
  }

  /**
   * Handle requests to get the current value of the "Cooling Threshold Temperature characteristic
   */
  async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET CoolingThresholdTemperature: ', this.targetTemp);
    return this.targetTemp;
  }

  /**
   * Handle requests to set the "CoolingThresholdTemperature characteristic
   */
  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET CoolingThresholdTemperature:', value);

    this.targetTemp = value as number;

    const options = {
      temperatureSetpoint: this.targetTemp,
    };

    this.ac.setStatus(options, 3);
  }
}
