/**
 * Copyright (c) 2017, Oracle and/or its affiliates. All rights reserved.
 *
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 */

define([
        '../../lib/9997_IBanValidator',
        '../../lib/9997_CommonLib',
        '../../lib/wrapper/9997_NsWrapperRuntime',
        '../../lib/wrapper/9997_NsWrapperSearch',
        '../../lib/wrapper/9997_NsWrapperError',
        '../../lib/wrapper/9997_NsWrapperDialog'
    ],

    function(ibanValidator, commonLib, runtime, search, error, dialog) {

        var ENTBANK_MSGS;
        var prefix = 'custpage_eft_';

        var AMEND_MANDATE_ID = '2';
        var AMEND_DEBTOR_ACCT = '3';
        //var AMEND_DEBTOR_AGENT = '4';
        var AMEND_CREDITOR_ID = '5';

        function saveRecord(scriptContext) {
            // check if there are primary and secondary details
            var record = scriptContext.currentRecord;
            var paymentFileFormat = record.getText('custpage_2663_entity_file_format');
            var searchResultsPrimary = false;
            var parentRecType = getParentRecType(record);
			
			//9572 - Global Entity
			// Set value of hidden subsidiary field from scripted field
			if(commonLib.isGlobalEntityFeatureEnabled(parentRecType)){
				record.setValue('custrecord_9572_subsidiary', record.getValue('custpage_9572_subsidiary'));
			}

            if (parentRecType) {
                var parentRecField = 'custrecord_2663_parent_' + parentRecType;
                var parentRec = record.getValue(parentRecField);
                if (parentRec) {
                    var primaryFilters = [];
                    primaryFilters.push( [ parentRecField,  'anyof', parentRec ] );
                    primaryFilters.push( 'and' );
                        primaryFilters.push( [ 'custrecord_2663_entity_bank_type' , 'anyof', 1 ] ); // primary type
                    if (record.id) {
                        primaryFilters.push( 'and' );
                        primaryFilters.push( ['internalid' , 'noneof',  record.id ] );// except this record
                    }
                    var ite = search.create( { type : 'customrecord_2663_entity_bank_details', filters : primaryFilters} ).getIterator();
                    if(ite.hasNext()){
                        searchResultsPrimary = true;
                    }
                }
            }

            //Start - Secondary bank: additional field validation of the required field.
            //we dont perform validation if inactive and has no parent entity.
            var isinactive = record.getValue('isinactive');
            if( !isinactive && parentRecType &&
                isUniqueBankName( record ) ){
                dialog.defaultAlert({
                    title   : 'EP_00114',
                    message : ENTBANK_MSGS.EP_00114
                });
                return false;
            }
            //End - Secondary bank

            var entityDetailType = record.getValue('custrecord_2663_entity_bank_type');
            // display warning message if setting the type to primary

            if (searchResultsPrimary && entityDetailType == '1') {
                dialog.defaultAlert({ message : ENTBANK_MSGS.changeprimary });
            }
            // display warning message if setting the type to secondary
            else if (!searchResultsPrimary && entityDetailType == '2') {
                dialog.defaultAlert({ message : ENTBANK_MSGS.noprimary });
            }

            // set the hidden file format field
            record.setValue('custrecord_2663_entity_file_format', record.getValue('custpage_2663_entity_file_format'));

            var errMsg = '';

            if (paymentFileFormat == 'Zengin') {
                saveRecord_Zengin(record);
            }

            if (paymentFileFormat == 'J.P. Morgan Freeform GMT') {
                errMsg = saveRecord_JPMorganFreeformGMT(record, ENTBANK_MSGS);
            }

            if (['SEPA Direct Debit (Germany)', 'SEPA Direct Debit (CBI)', 'SEPA Direct Debit (ABN AMRO)'].indexOf(paymentFileFormat) > -1) {
                errMsg = saveRecord_SEPA_DD(record);
            }

            if (paymentFileFormat == 'DTAZV' || paymentFileFormat == 'Barclays MT103') {
                if(!record.getValue(prefix + 'custrecord_2663_entity_iban') && !record.getValue(prefix + 'custrecord_2663_entity_acct_no')){
                    errMsg = paymentFileFormat == 'Barclays MT103' ?
                        ENTBANK_MSGS.noibanacctno :
                        ENTBANK_MSGS.noibanbanknos;
                }
            }

            if (!commonLib.isNullorEmpty(errMsg)) {
                dialog.defaultAlert({ message : errMsg});
                return false;
            }

            return true;
        }

        function isUniqueBankName(record){
            var name = record.getValue('name');
            var namesCache = JSON.parse(record.getValue('custpage_2663_entbanknames') );
            var res = true;

            if(namesCache){
                res = namesCache.find(function(entbank){
                    return (entbank.name == name) && (entbank.id != record.id);
                });
            }
            return res;
        }

        function saveRecord_Zengin(record){
            var ediFieldStr = record.getValue('custrecord_2663_edi');
            var ediValueStr = '';
            var custcodeStr = '';

            if (ediFieldStr) {
                ediValueStr = 'Y';
                custcodeStr = record.getValue('custrecord_2663_customer_code');
            }

            record.setValue('custrecord_2663_edi_value', ediValueStr);
            record.setValue('custrecord_2663_customer_code', custcodeStr);
        }

        function saveRecord_JPMorganFreeformGMT(record, ENTBANK_MSGS) {
            var errMsg = '';
            var bankCode = record.getValue('custrecord_2663_entity_bic');

            if (!commonLib.isNullorEmpty(bankCode) && (bankCode.length == 8 || bankCode.length == 11)) {
                var countryCode = bankCode.substring(4,6);

                if (countryCode == 'SA' || countryCode == 'LB') {
                    if (commonLib.isNullorEmpty(record.getValue('custrecord_2663_entity_iban'))) {
                        errMsg = ENTBANK_MSGS.noiban;
                    }
                }
            }

            return errMsg;
        }

        function saveRecord_SEPA_DD(record) {
            var errMsg = '';
            var missingFields = [];
            var refAmendment = record.getValue('custrecord_2663_entity_ref_amended');

            if (!commonLib.isNullorEmpty(refAmendment)) {
                switch(refAmendment) {
                    case AMEND_MANDATE_ID :
                        if (commonLib.isNullorEmpty(record.getValue('custrecord_2663_entity_issuer_num'))) {
                            missingFields.push('Original Reference Mandate');
                        }
                        break;
                    case AMEND_DEBTOR_ACCT :
                        if (commonLib.isNullorEmpty(record.getValue('custrecord_2663_entity_acct_no'))) {
                            missingFields.push('Original Debtor IBAN');
                        }
                        break;
                    case AMEND_CREDITOR_ID :
                        if (commonLib.isNullorEmpty(record.getValue('custrecord_2663_entity_acct_name'))) {
                            missingFields.push('Original Creditor Name');
                        }
                        if (commonLib.isNullorEmpty(record.getValue('custrecord_2663_entity_bank_no'))) {
                            missingFields.push('Original Creditor ID');
                        }
                        break;
                }

                if (missingFields.length > 0) {
                    errMsg = 'Please enter value(s) for: ' + missingFields.join(', ');
                }
            }

            return errMsg;
        }

        function fieldChanged(context){
            var record = context.currentRecord;
            var fieldId = context.fieldId;

            var paymentFileFormat = record.getText('custpage_2663_entity_file_format');
            if ((['SEPA Credit Transfer (SEB)', 'Plusgiro (SEB)', 'Bankgiro (SEB)'].indexOf(paymentFileFormat) > -1) && fieldId == prefix + 'custrecord_2663_entity_bic') {
                var swiftBICCode = record.getValue(fieldId);
                if (/[a-z]/.test(swiftBICCode)) {
                    swiftBICCode = swiftBICCode.toUpperCase();
                    record.setValue(fieldId, swiftBICCode, false);
                    record.setValue('custrecord_2663_entity_bic', swiftBICCode, true);
                }
            }

            // set form depending on file format
            if (fieldId == 'custpage_2663_entity_file_format') {
                var newURL = document.location.href;
                setWindowChanged(window, false);
                var paramIndex = newURL.indexOf('custparam_2663_init_file_format') - 1;
                if (paramIndex > -1) {
                    newURL = newURL.substring(0, paramIndex);
                }
                newURL += ['&custparam_2663_init_file_format=', record.getValue('custpage_2663_entity_file_format')].join('');
                document.location.assign(newURL);
            }else{
                var locPrefix = '';
                var fieldName  = '';
                //Modified below IDs as fix for Issue 599268(Custom field not getting saved). Existing logic was allowing only fields with "_2663_" in ID to save.
                if (fieldId.indexOf('custpage_eft_custrecord') > -1) {
                    fieldName = fieldId.substr(fieldId.indexOf('custrecord'));
                   // locPrefix = 'custpage_eft_custrecord_2663_'; commenting as locPrefix is not used.
                }
                else if (fieldId.indexOf('custpage_dd_custrecord') > -1) {
                    fieldName = fieldId.substr(fieldId.indexOf('custrecord'));
                   // locPrefix = 'custpage_dd_custrecord_2663_';
                }
                if(fieldName){
                    var value = record.getValue(fieldId);
                    record.setValue(fieldName , value);
                }
            }

            if (paymentFileFormat == 'Zengin') {
                fieldChanged_Zengin(record, fieldId);
            } else if ((paymentFileFormat == 'CNAB 240') && fieldId.indexOf(prefix + 'custrecord_2663_customer_code') > -1) {

                // toggle pre-filling of Registration Number
                if (record.getValue(prefix + 'custrecord_2663_customer_code') == '0') {
                    record.setValue('custrecord_2663_entity_bban', '00000000000000', true);
                    record.setValue(prefix + 'custrecord_2663_entity_bban', '00000000000000');
                }
            } else if ((paymentFileFormat == 'J.P. Morgan Freeform GMT') && fieldId.indexOf(prefix + 'custrecord_2663_entity_bic') > -1) {

                var bankCode = record.getValue(prefix + 'custrecord_2663_entity_bic');

                if (!commonLib.isNullorEmpty(bankCode) && (bankCode.length == 8 || bankCode.length == 11)) {
                    var countryCode = bankCode.substring(4,6);
                    record.setValue('custrecord_2663_entity_country_code', countryCode, true);
                    record.setValue(prefix + 'custrecord_2663_entity_country_code', countryCode, true);

                    if (countryCode == 'SA' || countryCode == 'LB') {
                        record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = false;
                    } else {
//                        record.setValue('custrecord_2663_entity_iban', '', false, false);
                        record.setValue(prefix + 'custrecord_2663_entity_iban', '', false, false);
                        record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = true;
                    }
                }
            } else if ((['SEPA Direct Debit (Germany)', 'SEPA Direct Debit (CBI)', 'SEPA Direct Debit (ABN AMRO)'].indexOf(paymentFileFormat) > -1) &&
                (fieldId.indexOf( prefix + 'custrecord_2663_entity_ref_amended') > -1)) {
                fieldChanged_SEPA_DD(record, fieldId);
            } else if (paymentFileFormat == 'ABO') {
                if (fieldId == prefix + 'custrecord_2663_entity_acct_no'){
                    var acctNo = record.getValue(prefix + 'custrecord_2663_entity_acct_no');

                    // parse two parts of account number
                    var part1 = acctNo.indexOf('-') > -1 ? acctNo.substr(0,acctNo.indexOf('-')) : '';
                    var part2 = acctNo.lastIndexOf('-') > -1 ? acctNo.substr(acctNo.lastIndexOf('-') + 1) : acctNo;

                    if (part1.length != 6 || part2.length != 10){
                        // apply leading zeros
                        part1 = commonLib.applyPadding('left','0',part1,6);
                        part2 = commonLib.applyPadding('left','0',part2,10);

                        // update account number
                        record.setValue(prefix + 'custrecord_2663_entity_acct_no', part1 + '-' + part2);
                        record.setValue('custrecord_2663_entity_acct_no', part1 + '-' + part2);
                    }

                }
                else if (fieldId == prefix + 'custrecord_2663_entity_payment_desc'){
                    // convert account fieldId to upper case (except ʃ character)
                    var paymentDesc = record.getValue(prefix + 'custrecord_2663_entity_payment_desc');
                    var converted = '';
                    for (var i = 0, ii = paymentDesc.length; i < ii; i++){
                        var ch = paymentDesc.charAt(i);
                        converted += (ch != 'ʃ') ? ch.toUpperCase() : ch;
                    }
                    //record.setValue( prefix + 'custrecord_2663_entity_payment_desc', converted, false);
                    record.setValue('custrecord_2663_entity_payment_desc', converted);
                }
            } else if (paymentFileFormat == 'DTAZV') {
                if (fieldId.indexOf(prefix + 'custrecord_2663_entity_acct_no') > -1) {
                    if(record.getValue(prefix + 'custrecord_2663_entity_acct_no') != ''){
                        record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_country_code').isDisabled = true;
                    } else{
                        record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = false;
                    }
                } else if (fieldId.indexOf(prefix + 'custrecord_2663_entity_iban') > -1) {
                    if(record.getValue(prefix + 'custrecord_2663_entity_iban') != ''){
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_country_code').isDisabled = true;
                    } else{
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = false;
                        record.getField(prefix + 'custrecord_2663_entity_country_code').isDisabled = false;

                        record.setValue(prefix + 'custrecord_2663_entity_country_code', '', true);
                        record.setValue('custrecord_2663_entity_country_code', '');
                    }
                }
                else if(fieldId == prefix + 'custrecord_2663_entity_country_code'){
                    record.setValue('custrecord_2663_entity_country_code',
                        (record.getValue(prefix + 'custrecord_2663_entity_country_code') || '').toUpperCase());
                }
            } else if (paymentFileFormat == 'Barclays MT103') {
                if (fieldId.indexOf( prefix + 'custrecord_2663_entity_acct_no') > -1) {
                    record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = (record.getValue(prefix + 'custrecord_2663_entity_acct_no') != '');
                } else if (fieldId.indexOf( prefix + 'custrecord_2663_entity_iban') > -1) {
                    var iban = record.getValue(fieldId) || '';
                    record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = (iban != '');
                    if (/[a-z]/.test(iban)) {
                        record.setValue(fieldId, iban.toUpperCase(), true);
                        record.setValue('custrecord_2663_entity_iban', iban.toUpperCase(), true);
                    }
                }
            }
        }

        function initForm(context){

            var record = context.currentRecord;
            if(record.getValue('custrecord_2663_entity_acct_no') && record.getValue('custpage_eft_custrecord_2663_entity_acct_no')){
                record.setValue('custrecord_2663_entity_acct_no',record.getValue('custpage_eft_custrecord_2663_entity_acct_no'));
            }

                if(!ENTBANK_MSGS){
                try{
                    ENTBANK_MSGS = JSON.parse(record.getValue('custpage_2663_translate_msgs') );
                }
                catch(err){
                    log.error('PARSING_ERROR', 'ERR in Parsing JSON');
                }
            }

            var paymentFileFormat = record.getText('custpage_2663_entity_file_format');
            if (paymentFileFormat == 'DTAZV' || paymentFileFormat == 'Barclays MT103') {
                var acctNum = record.getValue('custrecord_2663_entity_acct_no');
                var iban = record.getValue('custrecord_2663_entity_iban');

                record.getField(prefix + 'custrecord_2663_entity_iban').isDisabled = ( !commonLib.isNullorEmpty(acctNum) && commonLib.isNullorEmpty(iban) );
                record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = ( !commonLib.isNullorEmpty(iban) && commonLib.isNullorEmpty(acctNum) );

                if (paymentFileFormat == 'DTAZV') {
                    record.getField(prefix + 'custrecord_2663_entity_country_code').isDisabled = (  commonLib.isNullorEmpty(iban) && !commonLib.isNullorEmpty(acctNum) );
                }
            }
        }

        function validateField(context) {
            var record = context.currentRecord;
            var fieldId = context.fieldId;

            var paymentFileFormat = record.getText('custpage_2663_entity_file_format');
            if (['CBI Payments', 'AEB - Norma 34', 'CBI Collections', 'SEPA Credit Transfer (ABN AMRO)', 'SEPA Credit Transfer (Germany)', 'DTAZV', 'SEPA Credit Transfer (SEB)'].indexOf(paymentFileFormat) > -1) {
                validateField_IBAN(record, fieldId, paymentFileFormat);
            }
            else if (paymentFileFormat == 'ACH - CCD/PPD' || paymentFileFormat == 'ACH - CTX (Free Text)' || paymentFileFormat == 'ACH - PPD') {
                validateField_ACH(record, fieldId);
            }
            else if (paymentFileFormat == 'DTAUS' || paymentFileFormat == 'DTAUS DD') {
                validateField_DTAUS(record, fieldId);
            }
            else if (paymentFileFormat == 'Raiffeisen Domestic Transfer') {
                validateField_BBAN(record, fieldId);
            } else if (paymentFileFormat == 'ANZ') {
                if (fieldId.indexOf( prefix + 'custrecord_2663_entity_bban') > -1) {
                    //pad the account number suffix if length is less than 16
                    var accountNum = record.getValue(prefix + 'custrecord_2663_entity_bban');
                    if (!commonLib.isNullorEmpty(accountNum) && (accountNum.length == 15)) {
                        var newAccountNum = accountNum.substring(0, 13) + '0' + accountNum.substring(13);
                        record.setValue('custrecord_2663_entity_bban', newAccountNum, true);
                        record.setValue(prefix + 'custrecord_2663_entity_bban', newAccountNum, true);
                    }
                }
            } else if (paymentFileFormat == 'ASB' || paymentFileFormat == 'Westpac - Deskbank') {
                validateField_NZAccountNumber(record, paymentFileFormat, fieldId);
            }

            return true;
        }

        function validateField_IBAN(record, fieldId, paymentFileFormat){
            if (fieldId == prefix + 'custrecord_2663_entity_iban') {
                var ibanString = record.getValue(fieldId);

                if (['SEPA Credit Transfer (ABN AMRO)', 'SEPA Credit Transfer (Germany)', 'SEPA Credit Transfer (SEB)'].indexOf(paymentFileFormat) > -1 ) {
                    if (/[a-z]/.test(ibanString)) {
                        ibanString = ibanString.toUpperCase();
                        record.setValue(fieldId, ibanString, false);
                        record.setValue('custrecord_2663_entity_iban', ibanString, true);
                    }
                }

                ibanValidator.setIBAN(ibanString);
                if (ibanValidator.getValue() && ibanValidator.isValid()) {
                    var countryCode = paymentFileFormat == 'DTAZV' ? ibanValidator.getCountryCode().toUpperCase() : ibanValidator.getCountryCode();
                    record.setValue(prefix + 'custrecord_2663_entity_country_code', countryCode, false);
                    if(paymentFileFormat != 'DTAZV'){
                        record.setValue(prefix + 'custrecord_2663_entity_iban_check', ibanValidator.getCheckDigits(), false);
                        //Set derived values
                        if (paymentFileFormat == 'CBI Payments' || paymentFileFormat == 'CBI Collections') {
                            record.setValue(prefix + 'custrecord_2663_entity_country_check', ibanValidator.getDerivedValue(1), false);
                            record.setValue(prefix + 'custrecord_2663_entity_bank_no', ibanValidator.getDerivedValue(2), false);
                            record.setValue(prefix + 'custrecord_2663_entity_branch_no', ibanValidator.getDerivedValue(3), false);
                            record.setValue(prefix + 'custrecord_2663_entity_acct_no', ibanValidator.getDerivedValue(4), false);
                        }
                        else if (paymentFileFormat == 'AEB - Norma 34') {
                            record.setValue(prefix + 'custrecord_2663_entity_bank_no', ibanValidator.getDerivedValue(1), false);
                            record.setValue(prefix + 'custrecord_2663_entity_branch_no', ibanValidator.getDerivedValue(2), false);
                            record.setValue(prefix + 'custrecord_2663_entity_country_check', ibanValidator.getDerivedValue(3), false);
                            record.setValue(prefix + 'custrecord_2663_entity_acct_no', ibanValidator.getDerivedValue(4), false);
                        }
                    }
                }
            }
        }

        function validateField_BBAN(record, fieldId){
            if (fieldId == prefix + 'custrecord_2663_entity_bban') {
                ibanValidator.setBBAN('HU', record.getValue(fieldId));
                if (ibanValidator.getBBANValue() && ibanValidator.isBBANValid()) {
                    //Set derived values
                    record.setValue(prefix + 'custrecord_2663_entity_bank_no', ibanValidator.getBBANDerivedValue('bank_number'), false);
                    record.setValue(prefix + 'custrecord_2663_entity_branch_no', ibanValidator.getBBANDerivedValue('branch_number'), false);
                    record.setValue(prefix + 'custrecord_2663_entity_acct_no', ibanValidator.getBBANDerivedValue('account_number'), false);
                }
            }
        }

        function validateField_ACH(record, fieldId){
            if (fieldId == prefix + 'custrecord_2663_entity_bank_no') {
                commonLib.setACH(record.getValue(fieldId));
                if (commonLib.isValidRoutingNumber()) {
                    record.setValue(prefix + 'custrecord_2663_entity_processor_code', commonLib.getFederalReserveRoutingSymbol());
                    record.setValue(prefix + 'custrecord_2663_entity_bank_code', commonLib.getABAInstitutionIdentifier());
                    record.setValue(prefix + 'custrecord_2663_entity_country_check', commonLib.getCheckDigit());
                }
                else {
                    record.setValue(prefix + 'custrecord_2663_entity_processor_code', '');
                    record.setValue(prefix + 'custrecord_2663_entity_bank_code', '');
                    record.setValue(prefix + 'custrecord_2663_entity_country_check', '');
                }
            }
        }

        function validateField_DTAUS(record, fieldId){
            if (fieldId == prefix + 'custrecord_2663_entity_bank_no'
                      || fieldId == prefix + 'custrecord_2663_entity_acct_no') {
                var bankNumber = record.getValue(prefix + 'custrecord_2663_entity_bank_no');
                var accountNumber = record.getValue(prefix + 'custrecord_2663_entity_acct_no');

                var iban = '';
                if (bankNumber && accountNumber) {
                    iban = ibanValidator.generateFromBankAndAccountNum(bankNumber, accountNumber, 'DE');
                }
                record.setValue(prefix + 'custrecord_2663_entity_iban', iban);
            }
        }

        function validateField_NZAccountNumber(record, fileFormat, fieldId){
            var entityPrefix = 'custrecord_2663_entity_';

            if (fieldId ==  prefix + entityPrefix + 'bban') {
                //pad the account number suffix if length is less than 16
                var accountNum = record.getValue(prefix + entityPrefix + 'bban');

                if (!commonLib.isNullorEmpty(accountNum)) {
                    //populate other fields
                    commonLib.setNZAccountNumber(accountNum);
                    record.setValue(prefix + entityPrefix + 'bank_no', commonLib.getBankNumber());
                    record.setValue(prefix + entityPrefix + 'branch_no', commonLib.getBranchNumber());
                    record.setValue(prefix + entityPrefix + 'acct_no', commonLib.getUniqueAccountNumber());
                    record.setValue(prefix + entityPrefix + 'acct_suffix', commonLib.getBankAccountSuffix());
                }
            }
        }

        function fieldChanged_Zengin(record, fieldId){
            if (fieldId == prefix + 'custrecord_2663_edi') {
                if (!record.getValue(prefix + 'custrecord_2663_edi')) {
                    record.setValue(prefix + 'custrecord_2663_customer_code', '');
                   // record.setValue('custrecord_2663_customer_code', '');
                }

                var isCustCodeDisabled = !record.getValue(prefix + 'custrecord_2663_edi');
                record.getField(prefix + 'custrecord_2663_customer_code').isDisabled = isCustCodeDisabled;
            }
        }

        function fieldChanged_SEPA_DD(record, fieldId){
            if (fieldId == prefix + 'custrecord_2663_entity_ref_amended') {
                var refAmendment = record.getValue(fieldId);

                switch (refAmendment) {
                    case AMEND_MANDATE_ID: {
                        record.getField(prefix + 'custrecord_2663_entity_acct_name').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_bank_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_issuer_num').isDisabled = false;
                        //
                        // record.setValue('custrecord_2663_entity_acct_name', '');
                        // record.setValue('custrecord_2663_entity_acct_no', '');
                        // record.setValue('custrecord_2663_entity_bank_no', '');

                        record.setValue(prefix + 'custrecord_2663_entity_acct_no', '');
                        record.setValue(prefix + 'custrecord_2663_entity_acct_name', '');
                        record.setValue(prefix + 'custrecord_2663_entity_bank_no', '');
                        break;
                    }
                    case AMEND_DEBTOR_ACCT : {
                        record.getField(prefix + 'custrecord_2663_entity_acct_name').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = false;
                        record.getField(prefix + 'custrecord_2663_entity_bank_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_issuer_num').isDisabled = true;

                        // record.setValue('custrecord_2663_entity_acct_name', '');
                        // record.setValue('custrecord_2663_entity_bank_no', '');
                        // record.setValue('custrecord_2663_entity_issuer_num', '');

                        record.setValue(prefix + 'custrecord_2663_entity_bank_no', '');
                        record.setValue(prefix + 'custrecord_2663_entity_acct_name', '');
                        record.setValue(prefix + 'custrecord_2663_entity_issuer_num', '');
                        break;
                    }
                    case AMEND_CREDITOR_ID : {
                        record.getField(prefix + 'custrecord_2663_entity_acct_name').isDisabled = false;
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_bank_no').isDisabled = false;
                        record.getField(prefix + 'custrecord_2663_entity_issuer_num').isDisabled = true;

                        // record.setValue('custrecord_2663_entity_acct_no', '');
                        // record.setValue('custrecord_2663_entity_issuer_num', '');

                        record.setValue(prefix + 'custrecord_2663_entity_acct_no', '');
                        record.setValue(prefix + 'custrecord_2663_entity_bank_no', '');
                        break;
                    }
                    default : {
                        record.getField(prefix + 'custrecord_2663_entity_acct_name').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_acct_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_bank_no').isDisabled = true;
                        record.getField(prefix + 'custrecord_2663_entity_issuer_num').isDisabled = true;

                        // record.setValue('custrecord_2663_entity_acct_name', '');
                        // record.setValue('custrecord_2663_entity_acct_no', '');
                        // record.setValue('custrecord_2663_entity_bank_no', '');
                        // record.setValue('custrecord_2663_entity_issuer_num', '');

                        record.setValue(prefix + 'custrecord_2663_entity_acct_no', '');
                        record.setValue(prefix + 'custrecord_2663_entity_bank_no', '');
                        record.setValue(prefix + 'custrecord_2663_entity_acct_name', '');
                        record.setValue(prefix + 'custrecord_2663_entity_issuer_num', '');
                        break;
                    }

                }
            }
        }

        function getParentRecType(record) {
            var parentRecType = '';

            var isPartnerCommisionsEnabled = runtime.isFeatureInEffect({
                feature: 'PARTNERCOMMISSIONS'
            });

            if (isPartnerCommisionsEnabled && record.getValue('custrecord_2663_parent_partner')) {
                parentRecType = 'partner';
            }
            else if (record.getValue('custrecord_2663_parent_employee')) {
                parentRecType = 'employee';
            }
            else if (record.getValue('custrecord_2663_parent_customer')) {
                parentRecType = 'customer';
            }
            else if (record.getValue('custrecord_2663_parent_cust_ref')) {
                parentRecType = 'cust_ref';
            }
            else if (record.getValue('custrecord_2663_parent_vendor')) {
                parentRecType = 'vendor';
            }
            return parentRecType;
        }


        return {
            pageInit: initForm,
            fieldChanged: fieldChanged,
            validateField: validateField,
            saveRecord: saveRecord
        };

    });
