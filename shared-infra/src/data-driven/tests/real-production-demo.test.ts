/**
 * ALGORITHM SPECIFICATION:
 * 1. Load real production DTO JSON response (1,721 lines, demo.json) containing complex nested structures, audit timestamps, DTO arrays, and multi-level references.
 * 2. Define a comprehensive deep path mapping layout (remapDeepPaths) to extract, flatten, and normalize messy DTO paths into clean domain-driven objects.
 * 3. Battle-test execution using executeEnveloped pipeline processing to verify metadata creation, originalData retention (100% untouched raw payload), and reshaped domain output.
 * 4. Enforce strict functional immutability and verify that transformed structures preserve data integrity without throwing errors or mutating raw input.
 */

import { describe, it, expect } from 'vitest';
import {
  remapDeepPaths,
  executeDataDrivenPipeline,
  createDataPipeline,
  type DataPipelineSpec,
} from '../index';
import rawProductionData from './examples/demo.json';

describe('Real Production Response Battle Test — Reshaping demo.json DTOs', () => {
  it('reshapes 1,721-line messy DTO response into clean, normalized domain objects', () => {
    const rawData = Object.freeze(rawProductionData);

    const deepMappingSpec = [
      { from: 'id', to: 'installation.id' },
      { from: 'insNumber', to: 'installation.number' },
      { from: 'insapprovalStatus', to: 'installation.status' },
      { from: 'remarks', to: 'installation.remarks' },
      { from: 'installationDate', to: 'installation.date' },
      { from: 'installationType.name', to: 'installation.type' },
      { from: 'financialYear.shortname', to: 'installation.financialYearCode' },

      { from: 'contacts.id', to: 'contact.id' },
      { from: 'contacts.firstname', to: 'contact.firstName' },
      { from: 'contacts.email', to: 'contact.email' },
      { from: 'contacts.mobphone', to: 'contact.mobilePhone' },
      { from: 'contacts.offphone', to: 'contact.officePhone' },

      { from: 'accounts.id', to: 'account.id' },
      { from: 'accounts.accountName', to: 'account.name' },
      { from: 'accounts.panno', to: 'account.pan' },
      { from: 'accounts.accTypes.name', to: 'account.type' },
      { from: 'accounts.accCategory.name', to: 'account.category' },
      { from: 'accounts.leadSource.name', to: 'account.leadSource' },
      { from: 'accounts.regionsId.name', to: 'account.region' },

      { from: 'installationBillAddr.installationAddress', to: 'billingLocation.address' },
      { from: 'installationBillAddr.pincode', to: 'billingLocation.pincode' },
      { from: 'installationBillAddr.gstno', to: 'billingLocation.gstin' },
      { from: 'installationBillAddr.citiesId.name', to: 'billingLocation.city' },
      { from: 'installationBillAddr.citiesId.state.name', to: 'billingLocation.state' },
      { from: 'installationBillAddr.citiesId.state.country.name', to: 'billingLocation.country' },

      { from: 'installationSiteAddr.installationAddress', to: 'siteLocation.address' },
      { from: 'installationSiteAddr.pincode', to: 'siteLocation.pincode' },
      { from: 'installationSiteAddr.citiesId.name', to: 'siteLocation.city' },
      { from: 'installationSiteAddr.citiesId.state.name', to: 'siteLocation.state' },
      { from: 'installationSiteAddr.citiesId.state.country.name', to: 'siteLocation.country' },

      { from: 'technicianList[0].id', to: 'technician.id' },
      { from: 'technicianList[0].firstName', to: 'technician.firstName' },
      { from: 'technicianList[0].lastName', to: 'technician.lastName' },

      { from: 'mapInstallationProducts[0].qty', to: 'primaryProduct.quantity' },
      { from: 'mapInstallationProducts[0].products.productname', to: 'primaryProduct.name' },
      { from: 'mapInstallationProducts[0].products.hsncode', to: 'primaryProduct.hsn' },
      { from: 'mapInstallationProducts[0].products.unitrate', to: 'primaryProduct.unitPrice' },
      { from: 'mapInstallationProducts[0].products.productcategoryid.name', to: 'primaryProduct.category' },
      { from: 'mapInstallationProducts[0].products.productsubcategoryid.name', to: 'primaryProduct.subCategory' },

      { from: 'mapInstallationProducts[1].qty', to: 'secondaryProduct.quantity' },
      { from: 'mapInstallationProducts[1].products.productname', to: 'secondaryProduct.name' },
      { from: 'mapInstallationProducts[1].products.productcategoryid.name', to: 'secondaryProduct.category' },
    ];

    const reshaped = remapDeepPaths(rawData, deepMappingSpec) as Record<string, any>;

    expect(reshaped.installation).toBeDefined();
    expect(reshaped.installation.id).toBe(1919);
    expect(reshaped.installation.number).toBe('135/PRE-INS/26-27');
    expect(reshaped.installation.status).toBe('APPROVED');
    expect(reshaped.installation.type).toBe('Pre-Installation');
    expect(reshaped.installation.financialYearCode).toBe('26-27');

    expect(reshaped.contact).toBeDefined();
    expect(reshaped.contact.id).toBe(1327);
    expect(reshaped.contact.firstName).toBe('Srinivasa Reddy V');
    expect(reshaped.contact.email).toBe('reddy@amagi.com');
    expect(reshaped.contact.mobilePhone).toBe('7774326972');

    expect(reshaped.account).toBeDefined();
    expect(reshaped.account.id).toBe(1602);
    expect(reshaped.account.name).toBe('Amagi Media Labs Limited');
    expect(reshaped.account.pan).toBe('AAACT4033H');
    expect(reshaped.account.type).toBe('End User B2C');
    expect(reshaped.account.region).toBe(' Bang-Z1');

    expect(reshaped.billingLocation).toBeDefined();
    expect(reshaped.billingLocation.city).toBe('Bengaluru');
    expect(reshaped.billingLocation.state).toBe('Karnataka');
    expect(reshaped.billingLocation.country).toBe('India');
    expect(reshaped.billingLocation.pincode).toBe('560076');
    expect(reshaped.billingLocation.gstin).toBe('29AAACT4033H1ZG');

    expect(reshaped.siteLocation).toBeDefined();
    expect(reshaped.siteLocation.city).toBe('Bengaluru');
    expect(reshaped.siteLocation.state).toBe('Karnataka');
    expect(reshaped.siteLocation.country).toBe('India');

    expect(reshaped.technician).toBeDefined();
    expect(reshaped.technician.id).toBe(35);
    expect(reshaped.technician.firstName).toBe('Shruthi');

    expect(reshaped.primaryProduct).toBeDefined();
    expect(reshaped.primaryProduct.name).toBe('Vertiv UPS, Liebert MTP, 3 X 3, 100 KVA');
    expect(reshaped.primaryProduct.hsn).toBe('85044090');
    expect(reshaped.primaryProduct.quantity).toBe(23.0);
    expect(reshaped.primaryProduct.category).toBe('MHKVA - Online UPS');

    expect(reshaped.secondaryProduct).toBeDefined();
    expect(reshaped.secondaryProduct.name).toBe('200Ah/12V Quanta Make FR Rated SMF Battery');
    expect(reshaped.secondaryProduct.category).toBe('Quanta');
  });

  it('runs complete JSON spec pipeline with privacy hiding and enveloped output on demo.json', () => {
    const rawData = Object.freeze([rawProductionData]);

    const pipelineSpec: DataPipelineSpec = {
      name: 'ProductionDemoPipeline',
      steps: [
        {
          type: 'remapDeepPaths',
          mappings: [
            { from: 'id', to: 'installationId' },
            { from: 'insNumber', to: 'installationNumber' },
            { from: 'insapprovalStatus', to: 'status' },
            { from: 'contacts.firstname', to: 'primaryContact.name' },
            { from: 'contacts.email', to: 'primaryContact.email' },
            { from: 'accounts.accountName', to: 'clientAccount.name' },
            { from: 'accounts.panno', to: 'clientAccount.pan' },
            { from: 'installationBillAddr.citiesId.state.country.name', to: 'location.country' },
            { from: 'installationBillAddr.citiesId.state.name', to: 'location.state' },
            { from: 'installationBillAddr.citiesId.name', to: 'location.city' },
            { from: 'mapInstallationProducts[0].products.productname', to: 'primaryProduct.name' },
            { from: 'mapInstallationProducts[0].qty', to: 'primaryProduct.qty' },
          ],
        },
        {
          type: 'makeHidden',
          keys: ['clientAccount.pan'],
        },
      ],
    };

    const envelope = executeDataDrivenPipeline(rawData, pipelineSpec);

    expect(envelope.success).toBe(true);
    expect(envelope.pipelineMeta).toBeDefined();
    expect(envelope.pipelineMeta.operation).toBe('ProductionDemoPipeline');
    expect(envelope.pipelineMeta.stepsExecuted).toBe(2);

    expect(envelope.originalData).toBeDefined();
    expect(envelope.originalData[0].id).toBe(1919);
    expect(envelope.originalData[0].insNumber).toBe('135/PRE-INS/26-27');

    const result = envelope.data![0];
    expect(result.installationId).toBe(1919);
    expect(result.installationNumber).toBe('135/PRE-INS/26-27');
    expect(result.status).toBe('APPROVED');
    expect(result.primaryContact.name).toBe('Srinivasa Reddy V');
    expect(result.clientAccount.name).toBe('Amagi Media Labs Limited');

    expect(Object.prototype.hasOwnProperty.call(result.clientAccount, 'pan')).toBe(false);

    expect(result.location.country).toBe('India');
    expect(result.location.state).toBe('Karnataka');
    expect(result.location.city).toBe('Bengaluru');

    expect(result.primaryProduct.name).toBe('Vertiv UPS, Liebert MTP, 3 X 3, 100 KVA');
    expect(result.primaryProduct.qty).toBe(23.0);
  });

  it('uses fluent createDataPipeline helper to process demo.json with telemetry envelope', () => {
    const rawData = Object.freeze([rawProductionData]);

    const envelope = createDataPipeline(rawData)
      .remapDeepPaths([
        { from: 'id', to: 'domain.installationId' },
        { from: 'insNumber', to: 'domain.insNo' },
        { from: 'accounts.accountName', to: 'domain.company' },
        { from: 'installationBillAddr.citiesId.name', to: 'domain.city' },
      ])
      .makeHidden(['domain.insNo'])
      .executeEnveloped('ProductionFluentPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.data![0].domain.installationId).toBe(1919);
    expect(envelope.data![0].domain.company).toBe('Amagi Media Labs Limited');
    expect(envelope.data![0].domain.city).toBe('Bengaluru');
    expect(Object.prototype.hasOwnProperty.call(envelope.data![0].domain, 'insNo')).toBe(false);
  });

  it('extracts exactly 3 objects while retaining untouched original payload and supporting mid-pipeline state tapping', () => {
    const rawData = Object.freeze([rawProductionData]);

    let intermediateSnapshot: any = null;

    const envelope = createDataPipeline(rawData)
      .remapDeepPaths([
        { from: 'id', to: 'installation.id' },
        { from: 'insNumber', to: 'installation.number' },
        { from: 'insapprovalStatus', to: 'installation.status' },
        { from: 'accounts.accountName', to: 'account.name' },
        { from: 'accounts.panno', to: 'account.pan' },
        { from: 'installationBillAddr.citiesId.name', to: 'billingLocation.city' },
        { from: 'contacts.firstname', to: 'contact.name' },
        { from: 'technicianList[0].firstName', to: 'technician.firstName' },
      ])
      .tap((snapshot) => {
        intermediateSnapshot = snapshot;
      })
      .only(['installation', 'account', 'billingLocation'])
      .executeEnveloped('ThreeObjectsPipeline');

    expect(envelope.success).toBe(true);

    expect(intermediateSnapshot).toBeDefined();
    expect(intermediateSnapshot[0].contact).toBeDefined();
    expect(intermediateSnapshot[0].technician).toBeDefined();

    expect(envelope.originalData[0].id).toBe(1919);
    expect(envelope.originalData[0].insNumber).toBe('135/PRE-INS/26-27');
    expect(envelope.originalData[0].contacts).toBeDefined();
    expect(envelope.originalData[0].accounts).toBeDefined();
    expect(envelope.originalData[0].installationBillAddr).toBeDefined();

    const targetPayload = envelope.data![0];
    const rootKeys = Object.keys(targetPayload);
    expect(rootKeys).toHaveLength(3);
    expect(rootKeys.sort()).toEqual(['account', 'billingLocation', 'installation']);

    expect(targetPayload.installation).toEqual({
      id: 1919,
      number: '135/PRE-INS/26-27',
      status: 'APPROVED',
    });
    expect(targetPayload.account).toEqual({
      name: 'Amagi Media Labs Limited',
      pan: 'AAACT4033H',
    });
    expect(targetPayload.billingLocation).toEqual({
      city: 'Bengaluru',
    });

    expect(targetPayload.contact).toBeUndefined();
    expect(targetPayload.technician).toBeUndefined();
  });

  it('supports multi-stage tapping and pipeline branching at any intermediate step', () => {
    const rawData = Object.freeze([rawProductionData]);

    let stage1Raw: any = null;
    let stage2Remapped: any = null;
    let stage3Sanitized: any = null;

    const basePipeline = createDataPipeline(rawData)
      .tap((snap) => { stage1Raw = snap; })
      .remapDeepPaths([
        { from: 'id', to: 'installation.id' },
        { from: 'insNumber', to: 'installation.number' },
        { from: 'accounts.accountName', to: 'account.name' },
        { from: 'accounts.panno', to: 'account.secretPan' },
        { from: 'installationBillAddr.citiesId.name', to: 'billingLocation.city' },
        { from: 'contacts.firstname', to: 'contact.name' },
      ])
      .tap((snap) => { stage2Remapped = snap; });

    const hiddenPipeline = basePipeline
      .makeHidden(['account.secretPan'])
      .tap((snap) => { stage3Sanitized = snap; });

    const fullResult = hiddenPipeline.executeEnveloped('FullPipeline');
    const threeObjResult = hiddenPipeline
      .only(['installation', 'account', 'billingLocation'])
      .executeEnveloped('ThreeObjPipeline');

    expect(stage1Raw[0].id).toBe(1919);
    expect(stage1Raw[0].insNumber).toBe('135/PRE-INS/26-27');

    expect(stage2Remapped[0].account.secretPan).toBe('AAACT4033H');
    expect(stage2Remapped[0].contact.name).toBe('Srinivasa Reddy V');

    expect(Object.prototype.hasOwnProperty.call(stage3Sanitized[0].account, 'secretPan')).toBe(false);
    expect(stage3Sanitized[0].contact.name).toBe('Srinivasa Reddy V');

    expect(Object.keys(fullResult.data![0])).toContain('contact');
    expect(Object.keys(threeObjResult.data![0])).toEqual(['installation', 'account', 'billingLocation']);
  });
});
