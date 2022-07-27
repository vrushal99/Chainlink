/**
 * Copyright (c) 2017, Oracle and/or its affiliates. All rights reserved.
 * otherwise make available this code.
 *
 * Version    Date            Author           Remarks
 * 1.00       13 Mar 2017     aalcabasa
 *
 * @NModuleScope Public
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 *
 */
define([
        '../../app/10782_FormatRestrictor',
        '../../data/10782_FileFormatDAO',
        '../../lib/9997_IBanValidator',
        '../../lib/9997_CommonLib',
        '../../lib/wrapper/9997_NsWrapperRuntime',
        '../../lib/wrapper/9997_NsWrapperSearch',
        '../../lib/wrapper/9997_NsWrapperConfig',
        'N/ui/serverWidget',
        '../../lib/wrapper/9997_NsWrapperRedirect',
        '../../lib/wrapper/9997_NsWrapperRecord',
        '../../lib/translation/7716_translationWrapper_ss2',
        '../../lib/8859_Constants',
        '../../lib/15152_cipher_utility'
    ],

    function(formatRestrictor, fileFormatDAO, ibanValidator, commonLib, runtime,
             search, config, serverWidget, redirect, nsRecord, translationWrapper, constants,cipherUtil) {

        var CUSTENTITY_DIRECT_DEBIT = 'custentity_2663_direct_debit';
        var CUSTENTTTY_CUSTOMER_REFUND = 'custentity_2663_customer_refund';

        var CUSTRECORD_ENTITY_BANK_TYPE = 'custrecord_2663_entity_bank_type';
        var CUSTRECORD_ENTITY_FILE_FORMAT = 'custrecord_2663_entity_file_format';
        var CUSTRECORD_PAYMENT_TYPE = 'custrecord_2663_payment_file_type';

        var CUSTRECORD_BILL_SEQ_TYPE = 'custrecord_2663_entity_billing_seq_type';
        var CUSTRECORD_FIRST_PAY_DATE = 'custrecord_2663_first_pay_date';
        var CUSTOMRECORD_FILE_FORMAT = 'customrecord_2663_payment_file_format';
        var CUSTRECORD_FINAL_PAY_DATE = 'custrecord_2663_final_pay_date';
        var CUSTRECORD_UPDATE_ENTITY_DETAILS = 'custrecord_2663_update_entity_details';

        var fieldPrefix = 'custpage_eft_';
        var BANK_NAME = 'name';
        var EFT_PAYMENT_TYPE = '1';
        var DD_PAYMENT_TYPE = '2';
        var PRIMARY_ENTITY_DETAIL_TYPE = '1';

        var BILL_SEQ_RCUR = '2';
        //reference amendments
        var AMEND_MANDATE_ID = '2';
        var AMEND_DEBTOR_ACCT = '3';
        //var AMEND_DEBTOR_AGENT = '4';
        var AMEND_CREDITOR_ID = '5';

        var CUSTOMER = 'customer';
        var CUSTOMER_REFUND = 'cust_ref';
        var DIRECT_DEBIT = 'dd';
        var EFT = 'eft';
        var EMPLOYEE = 'employee';
        var PARTNER = 'partner';

        function loadParent(record, parentRecType, parentRecField){
            var parentRecId = record.getValue(parentRecField);
            var parentRec;
            if(parentRecType === CUSTOMER_REFUND){
                parentRec = nsRecord.load({ type : 'customer', id : parentRecId });
            }else{
                parentRec = nsRecord.load({ type : parentRecType, id : parentRecId });
            }
            return parentRec;
        }

        function getParentEntitySub(record, parentRecType, parentRecField){
            var parentRec=loadParent(record, parentRecType, parentRecField);
            var totalSubsidiary = parentRec.getLineCount('submachine');
            var parentEntitySub=[];
            for(var i =0;i<totalSubsidiary;i++){
                var tempSub = parentRec.getSublistValue({
                    sublistId: 'submachine',
                    fieldId: 'subsidiary',
                    line: i
                });
                var tempSubText = parentRec.getSublistText({
                    sublistId: 'submachine',
                    fieldId: 'subsidiary',
                    line: i
                });
                var istempSubinactive = parentRec.getSublistValue({
                    sublistId: 'submachine',
                    fieldId: 'issubinactive',
                    line: i
                });

                if( !istempSubinactive ){
                    parentEntitySub.push({value:tempSub, text:tempSubText});
                }
            }
            return parentEntitySub;
        }


        //9572 - Global Entity
        // Add scripted Subsidiary field for vendor and customer
        function createSubsidiaryList(record, form, parentRecType, parentRecField, MSGS){
            var names = MSGS.names;

            //get and hide the original field
            var origSubsidiaryFld = record.getField('custrecord_9572_subsidiary');
            origSubsidiaryFld.isDisplay = false;
            var selectedSub = record.getValue('custrecord_9572_subsidiary');

            // add field for Subsidiary depending on entity
            var subsidiaryFld = form.addField({
                id: 'custpage_9572_subsidiary',
                type: 'select',
                label: MSGS[names.labels.subsidiary]
            });

            subsidiaryFld.setHelpText(MSGS[names.flh.subsidiary]);
            subsidiaryFld.addSelectOption({ value : '', text : ''});

            var parentEntitySub=getParentEntitySub(record, parentRecType, parentRecField);
			var selected = false;
			var selectedSubName;
			for(var i=0; i<parentEntitySub.length; i++){
                var tempSub = parentEntitySub[i].value;
                if(selectedSub == tempSub){
                    selected = true;
                    selectedSubName = parentEntitySub[i].text;
                }else{
                    selected = false;
                }
                subsidiaryFld.addSelectOption({ value : tempSub, text : parentEntitySub[i].text, isSelected : selected});
            }
			if(selectedSubName != null && selectedSubName != undefined){
                subsidiaryFld.defaultValue = selectedSubName;
                record.setValue('custpage_9572_subsidiary', selectedSub);
            }
        }

        function checkSubsidiaryListCSV(currRecord, parentRecType, parentRecField, MSGS, csv_subsidiary_value){
            var names = MSGS.names;

            var parentEntitySub=getParentEntitySub(currRecord, parentRecType, parentRecField);
            for (var i =0; i< parentEntitySub.length; i++) {
                var flag=0;
                if (parentEntitySub[i].value === csv_subsidiary_value) {
                    flag=1;
                    break;
                }
            }
            if(flag===0){
                throw customError({
                    name : names.messages.EP_00131,
                    message : MSGS[names.messages.EP_00131],
                    notifyOff : true
                });
            }
        }


        function beforeLoad(context) {

            var record = context.newRecord;
            var form =  context.form;
            var type = context.type;
            var executionContext = runtime.executionContext;

            var MSGS = translationWrapper.getTranslation(translationWrapper.PAGE.ENTITY_BANK,runtime.getPreference('LANGUAGE'));
            var names = MSGS.names;

            var uiMap = MSGS.getComponentTranslation(MSGS.names.ui, MSGS);

            var fldtxtTrans = form.addField({
                id: 'custpage_2663_translate_msgs',
                type: 'longtext',
                label: 'MSGS'
            });
            fldtxtTrans.defaultValue = JSON.stringify(uiMap);
            fldtxtTrans.updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            });

            if (executionContext.toString().toLowerCase() == 'userinterface') {

                var parentRecType = getParentRecType(record);
                var parentRecField = 'custrecord_2663_parent_' + parentRecType;

                if (type == context.UserEventType.CREATE) {

                    if (parentRecType) {
                        log.debug('Payment Module Processing', 'Create bank details for: ' + record.getValue('custrecord_2663_parent_' + parentRecType));
                    }
                    else {
                        // redirect to home page if creating a record that is not linked to an entity
                        redirect.toTaskLink({ id : 'CARD_-29' });
                    }
                }

                if( type == context.UserEventType.VIEW || type == context.UserEventType.EDIT ){
                    if(runtime.isOW() && !validateRoleSubsidiary(record, (type == context.UserEventType.VIEW) )){
                        throw customError({
                            name : '',
                            message : 'You do not have access to ' + type + ' this record.',
                            notifyOff : true
                        });
                    }
                }

                if ( type == context.UserEventType.CREATE || type == context.UserEventType.EDIT ) {
					
					//9572 - Global Entity
                    // Add select subsidiary field if parent type is vendor or customer
					if(commonLib.isGlobalEntityFeatureEnabled(parentRecType)){
						createSubsidiaryList(record, form, parentRecType,parentRecField, MSGS);
					}

                    //only create entity bank details from the Partner record for vendor associated with Partners

                    if(parentRecType){
                        var bankNames = getEntityBankNames(record.getValue(parentRecField), getAllEntityParents(record) );

                        //hidden field to cache entity names for ui validations.
                        var fldCache = form.addField({
                            id: 'custpage_2663_entbanknames',
                            type: 'longtext',
                            label: 'Bank Cache'
                        });
                        fldCache.defaultValue = JSON.stringify(bankNames);
                        fldCache.updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.HIDDEN
                        });
                    }

                    if ((type == context.UserEventType.CREATE && getParentRecType(record) == 'vendor')) {

                        if (isPartnerCommisionsEnabled()) {
                            var parentVendorId = record.getValue('custrecord_2663_parent_vendor');
                            var lookupFields = search.lookupFields(
                                {type: 'vendor',
                                    id: parentVendorId ,
                                    columns: ['eligibleforcommission', 'custentity_2663_payment_method'] });

                            if (lookupFields.eligibleforcommission && lookupFields.custentity_2663_payment_method) {

                                log.error('Entity Bank Details UE beforeLoad',
                                    'Trying to create Entity Bank Details from Vendor when there is a Partner record');

                                var msg = MSGS[names.messages.EP_00093].replace('{value}', runtime.getPreference('NAMING_PARTNER'));
                                msg = msg.replace('{value2}', parentVendorId);

                                throw customError({
                                    name : names.messages.EP_00093,
                                    message : msg,
                                    notifyOff : true
                                });
                            }
                        }
                    }

                    createPaymentFileFormatList(record, form, MSGS, names,
                        context.request.parameters.custparam_2663_init_file_format || record.getValue('custrecord_2663_entity_file_format'));
                    //hide all fields
                    hideAllFields(form, ['custrecord_2663_entity_bank_type', BANK_NAME]);

                    //display fields specified on format
                    displayReferenceFields(form, record, record.getValue('custpage_2663_entity_file_format'),type);

                    // ------ format specific -------
                    beforeLoad_Zengin(record,form);
                    beforeLoad_SEPA_DD(record, form);
                }
            }
        }

        function validateRoleSubsidiary(record, viewContext) {
            try{

                //load parent subsidiary
                var parentRecType = getParentRecType(record);
                var parentRecordType = (parentRecType === 'cust_ref' ) ? 'customer' : parentRecType;
				//issue-576706 changed parentRecordType to parentRecType then it is able get parentRecordId from customer refund record
                var parentRecField = 'custrecord_2663_parent_' + parentRecType;
                var parentRecordId = record.getValue(parentRecField);
                var parentRec = nsRecord.load({ type : parentRecordType, id : parentRecordId });
                var subsidiaryOptions = [];
				//because employee and partners dont have subsidiary sublist 
                //if multisubsidiary feature is not enabled for customer
				//and for customer refund entity banks 
                if(((!runtime.isMultiSubsidiaryCustomerEnabled())&&(parentRecField==='custrecord_2663_parent_customer'||parentRecField==='custrecord_2663_parent_cust_ref'))
                   ||parentRecField==='custrecord_2663_parent_partner'||parentRecField==='custrecord_2663_parent_employee')
                  {
                    subsidiaryOptions.push(parentRec.getValue('subsidiary'));
                  }
                 else{
                    //issue 606488 Allow users to access the entity bank records of all those accessible entities whose primary/secondary subsidiaries fall
				   //under the access criteria for the custom roles defined. (PSGEPR-2927) 
                      var numLines = parentRec.getLineCount({
                          sublistId : 'submachine'
                      });
                      if (numLines > 0) {
                          for (var i = 0; i < numLines; i++) {
                              var subsidiary = parentRec.getSublistValue({
                                  sublistId : 'submachine',
                                  fieldId : 'subsidiary',
                                  line : i
                              });
                             subsidiaryOptions.push(subsidiary);
                          }
                      }
                }

                // Multisubsidiary
                // var subsidiaryOptions = subField.getSelectOptions();
                //    log.debug('subsidiaryOptions', JSON.stringify(subsidiaryOptions));
                var user = runtime.getCurrentUser();
                var userSubsidiary = user.subsidiary;
                var userRoleId = user.role;
                //If User is not 'Administrator'
                if (userRoleId != 3) {
                    var roleRecord = nsRecord.load({
                        type: 'role',
                        id: userRoleId
                    });
                    log.debug('Role ID', userRoleId);

                    //cross-subsidiary Viewing option is allowed
                    if(viewContext){
                        if(roleRecord.getValue('subsidiaryviewingallowed')){
                            return true;
                        }
                    }

                    //Load subsidiary restrictions
                    var subsidiaryRestriction = roleRecord.getValue('subsidiaryoption');
                    log.debug('Subsidiary Restriction Option', subsidiaryRestriction + ' **Bank Subsidiary ==> ' + JSON.stringify(subsidiaryOptions));
                    if (subsidiaryRestriction != null) {
                        if (subsidiaryRestriction == 'OWN') {
                            if(searchValue(subsidiaryOptions, userSubsidiary)) {
                                return true;
                            }
                        }
                        else if (subsidiaryRestriction == 'SELECTED') {
                            var selectedSubsidiaries = roleRecord.getValue('subsidiaryrestriction');
                            log.debug('Selected subsidiaryrestriction :: ', selectedSubsidiaries);
                            if (selectedSubsidiaries.length == 0) {
                                return false;
                            }
                            else {
                                for (var i = 0; i < subsidiaryOptions.length; i++) {
                                    if (searchValue(selectedSubsidiaries, subsidiaryOptions[i]))
                                        return true;
                                }
                            }
                        }
                        else if (subsidiaryRestriction == 'ALLACTIVE'){
                            if( validateActiveSubsidiary(subsidiaryOptions) ) {
                                return true;
                            }
                        }else {
                            return true;
                        }
                    }
                }
                else {
                    return true;
                }
            }catch(error){
                log.error('validateRoleSubsidiary', error.name + '::' + error.message);
                return true;
            }
            return false;
        }

        function searchValue(arrayValues,value){
            for (var i=0;i<arrayValues.length;i++)
            {
                if(arrayValues[i]==value)
                    return true;
            }
            return false;
        }

        function validateActiveSubsidiary(subsidiaryList){

            var tempSubList = subsidiaryList;
            var maxSearchLimit = 1000;
            var activeFlag=false;

            while(tempSubList.length>0) {

                if(maxSearchLimit > tempSubList.length){
                    maxSearchLimit = tempSubList.length;
                }

                var currSubList = tempSubList.splice(0,maxSearchLimit);

                var filters = [];
                filters.push( ['internalid' , 'anyof', currSubList] );
                filters.push('and');
                filters.push( ['isinactive', 'is',   'F' ] );
                var resultSet = search.create({type: 'Subsidiary', filters : filters }).run().getRange({
                    start : 0,
                    end : 2
                });
                if(resultSet.length > 0){
                    activeFlag=true;
                    return activeFlag;
                }
            }
            return activeFlag;
        }

        function updateGEEntityFields(paymentType, record, subsidiary, format){
            if(paymentType === EFT){
                record.setValue('custentity_9572_vendor_entitybank_sub', subsidiary);
                record.setValue('custentity_9572_vendor_entitybank_format', format);
            }else if(paymentType === DIRECT_DEBIT){
                record.setValue('custentity_9572_ddcust_entitybank_sub', subsidiary);
                record.setValue('custentity_9572_ddcust_entitybnkformat', format);
            }else if(paymentType === CUSTOMER_REFUND){
                record.setValue('custentity_9572_refundcust_entitybnk_sub', subsidiary);
                record.setValue('custentity_9572_refcust_entitybnkformat', format);
            }
        }

        function setDDEntityFields(context, parentRecType, record, type, isGEAccount, newRecord){
            var parentRecField = 'custrecord_2663_parent_' + parentRecType;
            var parentRecId = record.getValue(parentRecField);
            var recId = record.id;

            //var fileFormat = record.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
			//If File Format is updated, then take new value from newRecord else take it from oldRecord.
			var fileFormat;
			if(newRecord && newRecord.getValue(CUSTRECORD_ENTITY_FILE_FORMAT)){
                fileFormat = newRecord.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
            } else{
                fileFormat = record.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
            }

            var ddEnabled = search.lookupFields({ type: parentRecType, id: parentRecId, columns : CUSTENTITY_DIRECT_DEBIT });
            var fileFormatType = search.lookupFields({ type: CUSTOMRECORD_FILE_FORMAT,
                id: fileFormat,
                columns : CUSTRECORD_PAYMENT_TYPE });
            var fileFormatTypeValue;
            if(fileFormatType && fileFormatType.custrecord_2663_payment_file_type && Object.keys(fileFormatType.custrecord_2663_payment_file_type).length > 0 && fileFormatType.custrecord_2663_payment_file_type[0].hasOwnProperty('value')){
                fileFormatTypeValue = fileFormatType.custrecord_2663_payment_file_type[0]['value'];
            }
            var ddFormatType = fileFormatTypeValue === DD_PAYMENT_TYPE;
            log.debug('setDDEntityFields', 'ddEnabled::' + ddEnabled.custentity_2663_direct_debit + ' ddFormatType:: ' + ddFormatType);
            if(ddEnabled && ddEnabled.custentity_2663_direct_debit && ddFormatType) {
				
					//If Entity Bank Type is updated, then take new value from newRecord else take it from oldRecord.
					var entityDetailType;
					if(newRecord && newRecord.getValue(CUSTRECORD_ENTITY_BANK_TYPE)){
                        entityDetailType = newRecord.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                    } else{
                        entityDetailType = record.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                    }

                    //var entityDetailType = record.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                    var primaryEntityDetailType = entityDetailType === PRIMARY_ENTITY_DETAIL_TYPE;
                    var tempRec;
                    var isInactive = record.getValue('isinactive');
                    if(primaryEntityDetailType && !isInactive){
                        if ( type === context.UserEventType.CREATE || type === context.UserEventType.EDIT || type === context.UserEventType.XEDIT){
                            tempRec = nsRecord.load({
                                type: parentRecType,
                                id: parentRecId,
                                isDynamic : true
                            });
                            tempRec.setValue({
                                fieldId : 'custentity_9997_dd_file_format',
                                value : fileFormat
                            });

                        var updateEntityDetails = search.lookupFields({
                            type : CUSTOMRECORD_FILE_FORMAT,
                            id : fileFormat,
                            columns : CUSTRECORD_UPDATE_ENTITY_DETAILS
                        });
                        log.debug('setDDEntityFields', 'updateEntityDetails = ' + updateEntityDetails.custrecord_2663_update_entity_details);
                        // 9572 GE populate entity fields
                        if(updateEntityDetails && updateEntityDetails.custrecord_2663_update_entity_details){
                            var finalPayDate = record.getValue(CUSTRECORD_FINAL_PAY_DATE);
                            if(!finalPayDate){
                                tempRec.setValue({
                                    fieldId : 'custentity_9572_dd_file_format',
                                    value : fileFormat
                                });
                                if(isGEAccount){
                                    var selectedSubsidiary = commonLib.getFieldValue(newRecord, record, 'custrecord_9572_subsidiary');
                                    if(selectedSubsidiary){
                                        updateGEEntityFields(DIRECT_DEBIT, tempRec, selectedSubsidiary, fileFormat);
                                    } else {
                                        updateGEEntityFields(DIRECT_DEBIT, tempRec, '', '');
                                    }
                                }
                            }else{
                                // file format will be set as null so that the transactions cannot be processed when final payment date is populated
                                tempRec.setValue({
                                    fieldId : 'custentity_9572_dd_file_format',
                                    value : ''
                                });
                            }
                        }else{
                            tempRec.setValue({
                                fieldId : 'custentity_9572_dd_file_format',
                                value : fileFormat
                            });
                            if(isGEAccount){
                                var selectSubsidiary = commonLib.getFieldValue(newRecord, record, 'custrecord_9572_subsidiary');
                                if(selectSubsidiary){
                                    updateGEEntityFields(DIRECT_DEBIT, tempRec, selectSubsidiary, fileFormat);
                                } else {
                                    updateGEEntityFields(DIRECT_DEBIT, tempRec, '', '');
                                }
                            }
                        }

                        tempRec.save();

                        } else if(type === context.UserEventType.DELETE){
                            tempRec = nsRecord.load({
                                type: parentRecType,
                                id: parentRecId,
                                isDynamic : true
                            });
                            tempRec.setValue({
                                fieldId : 'custentity_9997_dd_file_format',
                                value : ''
                            });
                        // 9572 GE clear entity fields
                        tempRec.setValue({
                            fieldId : 'custentity_9572_dd_file_format',
                            value : ''
                        });
                        if(isGEAccount){
                            updateGEEntityFields(DIRECT_DEBIT, tempRec, '', '');
                        }
                            tempRec.save();
                        }
                    } else { // if this is being set as secondary and no other entity bank details is primary, clear this field
                        var primaryBankDetails = getPrimaryEntityBankDetails(parentRecField, parentRecId, recId);
                        if (( type === context.UserEventType.CREATE || type === context.UserEventType.EDIT || type === context.UserEventType.XEDIT)
                                        && primaryBankDetails.length===0 ){
                            tempRec = nsRecord.load({
                                type: parentRecType,
                                id: parentRecId,
                                isDynamic : true
                            });
                            tempRec.setValue({
                                fieldId : 'custentity_9997_dd_file_format',
                                value : ''
                            });
                        // 9572 GE clear entity fields
                        tempRec.setValue({
                            fieldId : 'custentity_9572_dd_file_format',
                            value : ''
                        });
                        if(isGEAccount){
                            updateGEEntityFields(DIRECT_DEBIT, tempRec, '', '');
                        }
                            tempRec.save();
                        }
                    }
                }
            }

        function setCREntityFields(context, parentRecType, record, type, isGEAccount, newRecord){
            var parentRecField = 'custrecord_2663_parent_' + parentRecType;
            var parentRecId = record.getValue(parentRecField);
            var recId = record.id;
            var parentRecordType = CUSTOMER;
			
            //var fileFormat = record.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
			//If File Format is updated, then take new value from newRecord else take it from oldRecord.
			var fileFormat;
			if(newRecord && newRecord.getValue(CUSTRECORD_ENTITY_FILE_FORMAT)){
                fileFormat = newRecord.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
            } else{
                fileFormat = record.getValue(CUSTRECORD_ENTITY_FILE_FORMAT);
            }

            var crEnabled = search.lookupFields({ type: parentRecordType, id: parentRecId, columns : CUSTENTTTY_CUSTOMER_REFUND });
            if(crEnabled && crEnabled.custentity_2663_customer_refund) {
				
				//If Entity Bank Type is updated, then take new value from newRecord else take it from oldRecord.
				var entityBankDetailType;
				if(newRecord && newRecord.getValue(CUSTRECORD_ENTITY_BANK_TYPE)){
                    entityBankDetailType = newRecord.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                } else{
                    entityBankDetailType = record.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                }

                //var entityBankDetailType = record.getValue(CUSTRECORD_ENTITY_BANK_TYPE);
                var primaryEntityBankDetailType = entityBankDetailType === PRIMARY_ENTITY_DETAIL_TYPE;
                var tempRec;
                var isInactive = record.getValue('isinactive');
                if(primaryEntityBankDetailType && !isInactive){
                    if ( type === context.UserEventType.CREATE || type === context.UserEventType.EDIT || type === context.UserEventType.XEDIT){
                        tempRec = nsRecord.load({
                            type: parentRecordType,
                            id: parentRecId,
                            isDynamic : true
                        });
                        // 9572 GE populate entity fields
                        tempRec.setValue({
                            fieldId : 'custentity_9572_custref_file_format',
                            value : fileFormat
                        });
                        if(isGEAccount){
                            var selectedSubsidiary = commonLib.getFieldValue(newRecord, record, 'custrecord_9572_subsidiary');
                            if(selectedSubsidiary){
                                updateGEEntityFields(CUSTOMER_REFUND, tempRec, selectedSubsidiary, fileFormat);
                            } else {
                                updateGEEntityFields(CUSTOMER_REFUND, tempRec, '', '');
                            }
                        }
                        tempRec.save();

                    } else if(type === context.UserEventType.DELETE){
                        tempRec = nsRecord.load({
                            type: parentRecordType,
                            id: parentRecId,
                            isDynamic : true
                        });
                        // 9572 GE clear entity fields
                        tempRec.setValue({
                            fieldId : 'custentity_9572_custref_file_format',
                            value : ''
                        });
                        if(isGEAccount){
                            updateGEEntityFields(CUSTOMER_REFUND, tempRec, '', '');
                        }
                        tempRec.save();
                    }
                } else { // if this is being set as secondary and no other entity bank details is primary, clear this field
                    var primaryBankDetails = getPrimaryEntityBankDetails(parentRecField, parentRecId, recId);
                    if (( type === context.UserEventType.CREATE || type === context.UserEventType.EDIT || type === context.UserEventType.XEDIT)
                        && primaryBankDetails.length===0 ){
                        tempRec = nsRecord.load({
                            type: parentRecordType,
                            id: parentRecId,
                            isDynamic : true
                        });
                        // 9572 GE clear entity fields
                        tempRec.setValue({
                            fieldId : 'custentity_9572_custref_file_format',
                            value : ''
                        });
                        if(isGEAccount){
                            updateGEEntityFields(CUSTOMER_REFUND, tempRec, '', '');
        }
                        tempRec.save();
                    }
                }
            }
        }


        /**
         * Entity Bank Details records has link to the entity it is used in.
         * Given a payment record, we fetch all entity bank records that are linked to the payment's entity
         *
         * This method will return a list of Entity Bank Details records which match the entity id and entity type.
         * @param  {Integer} entityid the id of the entity whose banks we want to retrieve the records.
         *  @param {Array}  The record type of the entity we want to retrieve, can be a customer, partner, vendor, or employee
         * @return {Array}  List of entity bank names and their corresponding id.
         */
        function getEntityBankNames(entityids, parents){

            var searchResult = [];

            if(parents && parents.length > 0){

                //get all the entity banks of all its parent.
                var filtersObj = [];
                parents.map(function(el){
                    var parentRecField =  'custrecord_2663_parent_' + el.recType;
                    filtersObj.push([ parentRecField, 'anyof',  el.id ]);
                    filtersObj.push( 'and' );
                });
                filtersObj.push( ['isinactive', 'is',   'F' ] );

                var columnObj =  [ 'name' , 'internalid' ];
                var ite = search.create({ type : 'customrecord_2663_entity_bank_details',
                    columns : columnObj, filters : filtersObj})
                    .getIterator();
                while(ite.hasNext()){
                    var res = ite.next();
                    searchResult.push({id:res.id, name: res.getValue('name')});
                }
            }

            return searchResult;
        }

        /**
         *
         * It is possible in CSV upload for the entity bank to have multiple parents
         * we get all the parents for validation purposes of a unique name.
         *
         * @return {Array}  An array of objects containing the entity record type and the id.
         */
        function getAllEntityParents(record){

            var parentFields = ['partner', 'employee', 'cust_ref', 'vendor', 'customer'];
            var parents = [];

            for(var i=0; i< parentFields.length; i++ ){
                var val = record.getValue('custrecord_2663_parent_' + parentFields[i]);

                if(val){
                    parents.push({recType: parentFields[i], id: val});
                }
            }

            return parents;
        }

        function afterSubmit(context) {
            var type = context.type;
            var currRecord = context.newRecord;
            var oldRecord = context.oldRecord;

            var allowedEntities = new Array();
            allowedEntities[0] = 'vendor';
            allowedEntities[1] = 'employee';
            if (isPartnerCommisionsEnabled()) {
                allowedEntities[2]  = 'partner';
            }
			var parentRecType;
			var parentRecField;
			var parentRecId;
			var entityDetailType;
			var parentRec;
			var eftEnabled;
			var fileFormat;
            var isGEAccount;
            var isInactive;

            if ( type == context.UserEventType.DELETE ) {

                parentRecType = getParentRecType(oldRecord);
                isGEAccount = commonLib.isGlobalEntityFeatureEnabled(parentRecType);
                if (parentRecType) {
                    entityDetailType = oldRecord.getValue('custrecord_2663_entity_bank_type');
                    if (entityDetailType == '1') {
                        parentRecField = 'custrecord_2663_parent_' + parentRecType;
                        parentRecId = oldRecord.getValue(parentRecField);
                        if (allowedEntities.indexOf(parentRecType) > -1) {
                            parentRec = nsRecord.load({ type : parentRecType, id : parentRecId });
                            eftEnabled = parentRec.getValue('custentity_2663_payment_method');
                            if (eftEnabled) {
                                parentRec.setValue('custentity_2663_eft_file_format', '');
                                // 9572 Update Entity Fields for GE
                                if(isGEAccount){
                                    updateGEEntityFields(EFT, parentRec, '', '');
                                }
                                parentRec.save();
                            }
                        }
                    }
                    var recType = (parentRecType == 'cust_ref' ) ? 'customer' : parentRecType;

                    redirect.toRecord( { type : recType,
                        id : oldRecord.getValue('custrecord_2663_parent_' + parentRecType) } );
                }
                if(parentRecType === CUSTOMER){
                    setDDEntityFields(context, parentRecType, oldRecord, type, isGEAccount);
                }else if(parentRecType === CUSTOMER_REFUND){
                    setCREntityFields(context, parentRecType, oldRecord, type, isGEAccount);
                }

            }
            else if (type == context.UserEventType.CREATE || type == context.UserEventType.EDIT) {
                // set the type to primary if there are no primary entity bank details yet
                parentRecType = getParentRecType(currRecord);
                isGEAccount = commonLib.isGlobalEntityFeatureEnabled(parentRecType);
                if (parentRecType) {
                    parentRecField = 'custrecord_2663_parent_' + parentRecType;
                    parentRecId = currRecord.getValue(parentRecField);
                    if (parentRecId) {
                        var recId = currRecord.id;
                        entityDetailType = currRecord.getValue('custrecord_2663_entity_bank_type');
                        //check whether this bank is active or not
                        isInactive = currRecord.getValue('isinactive');
                        // set other details to secondary if this detail is set to primary
                        if (entityDetailType == '1' && !isInactive) {
                            // set bank detail type to secondary for other results
                            var searchResults = getPrimaryEntityBankDetails(parentRecField, parentRecId, recId);
                            if (searchResults) {
                                for (var i = 0; i < searchResults.length; i++) {
                                    //Fix: After Submit currRecord(context.newRecord) is readOnly, cannot use submitFields here. Need to load record and submit again.
                                    /*currRecord.submitFields({
                                        type: 'customrecord_2663_entity_bank_details',
                                        id: searchResults[i].id,
                                        values: {
                                            custrecord_2663_entity_bank_type : '2'
                                        }
                                    });*/
                                    var tempRec = nsRecord.load({
                                        type: 'customrecord_2663_entity_bank_details',
                                        id:searchResults[i].id,
                                        isDynamic : true
                                    });
                                    tempRec.setValue({
                                        fieldId : 'custrecord_2663_entity_bank_type',
                                        value : 2
                                    });
                                    tempRec.save();

                                }
                            }

                            //set vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if eft is enabled
                            if (allowedEntities.indexOf(parentRecType) > -1) {
                                parentRec = nsRecord.load({ type : parentRecType, id : parentRecId });
                                eftEnabled = parentRec.getValue('custentity_2663_payment_method');
                                if (eftEnabled) {
                                    fileFormat = currRecord.getValue('custrecord_2663_entity_file_format');
                                    var fieldEdited = false;
                                    if (fileFormat) {
                                        parentRec.setValue('custentity_2663_eft_file_format', fileFormat);
                                        fieldEdited = true;
                                    }
                                    // 9572 Update Entity Fields for GE
                                    if(isGEAccount){
                                        var selectedSubsidiary = currRecord.getValue('custrecord_9572_subsidiary');
                                        if(selectedSubsidiary){
                                            updateGEEntityFields(EFT, parentRec, selectedSubsidiary, fileFormat);
                                        }else{
                                            updateGEEntityFields(EFT, parentRec, '', '');
                                        }
                                        fieldEdited = true;
                                    }
                                    if(fieldEdited){
                                        parentRec.save();
                                    }
                                }
                            }
                        }
                        //clear vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if this is set to secondary or set to inactive
                        else if ((entityDetailType == '2' || isInactive) && allowedEntities.indexOf(parentRecType) > -1) {
                            //clear vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if there are no primary details
                            if (getPrimaryEntityBankDetails(parentRecField, parentRecId, recId).length ===0) {
                                parentRec =  nsRecord.load({ type : parentRecType, id : parentRecId });
                                parentRec.setValue('custentity_2663_eft_file_format', '');
                                // 9572 Update clear entity fields for GE
                                if(isGEAccount){
                                    updateGEEntityFields(EFT, parentRec, '', '');
                                }
                                parentRec.save();
                            }
                        }
                    }
                }
                if(parentRecType == CUSTOMER){
                    setDDEntityFields(context, parentRecType, currRecord, type, isGEAccount);
                }else if(parentRecType == CUSTOMER_REFUND){
                    setCREntityFields(context, parentRecType, currRecord, type, isGEAccount);
                }
            }
            else if (type == context.UserEventType.XEDIT) {

                if(currRecord){

					//In XEDIT(Inline editing, mass update, console updates) context, context.newRecord holds only the modified fields, while context.oldRecord holds the record present in DB
                    parentRecType = getParentRecType(oldRecord);//Passing oldRecord here because parent record information will not be available in newRecord
                    isGEAccount = commonLib.isGlobalEntityFeatureEnabled(parentRecType);
                    var parentRecordType = (parentRecType == 'cust_ref' ) ? 'customer' : parentRecType;
                    //set vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if eft is enabled
                    if (parentRecordType && isInArray(parentRecordType, allowedEntities)) {
                        parentRecField = 'custrecord_2663_parent_' + parentRecordType;
                        var parentRecordId = oldRecord.getValue(parentRecField);
                        parentRec = nsRecord.load({ type : parentRecordType, id : parentRecordId });

                        if(parentRec){
                            var recId = currRecord.id;
                            eftEnabled = parentRec.getValue('custentity_2663_payment_method');
                            if (eftEnabled) {
                                //check whether this bank is active or not
                                isInactive = currRecord.getValue('isinactive');
                                fileFormat = currRecord.getValue('custrecord_2663_entity_file_format');
                                entityDetailType = currRecord.getValue('custrecord_2663_entity_bank_type');
                                var isFieldEdited = false;
                                if(isInactive){
                                    parentRec.setValue('custentity_2663_eft_file_format', '');
                                    isFieldEdited = true;
                                }
                                if(fileFormat) {
                                    parentRec.setValue('custentity_2663_eft_file_format', fileFormat);
                                    isFieldEdited = true;
                                }

                                if (entityDetailType == '1' && !isInactive) {
                                    // set bank detail type to secondary for other results
                                    var searchResults = getPrimaryEntityBankDetails(parentRecField, parentRecordId, recId);
                                    if (searchResults) {
                                        for (var i = 0; i < searchResults.length; i++) {
                                            var tempRec = nsRecord.load({
                                                type: 'customrecord_2663_entity_bank_details',
                                                id:searchResults[i].id,
                                                isDynamic : true
                                            });
                                            tempRec.setValue({
                                                fieldId : 'custrecord_2663_entity_bank_type',
                                                value : 2
                                            });
                                            tempRec.save();

                                        }
                                    }

                                    //set vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if eft is enabled
                                    if (allowedEntities.indexOf(parentRecType) > -1) {
                                        eftEnabled = parentRec.getValue('custentity_2663_payment_method');
                                        if (eftEnabled) {
                                            fileFormat = commonLib.getFieldValue(currRecord, oldRecord, 'custrecord_2663_entity_file_format');
                                            if (fileFormat) {
                                                parentRec.setValue('custentity_2663_eft_file_format', fileFormat);
                                                isFieldEdited = true;
                                            }
                                        }
                                    }
                                }
                                //clear vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if this is set to secondary or set to inactive
                                else if ((entityDetailType == '2' || isInactive) && allowedEntities.indexOf(parentRecType) > -1) {
                                    //clear vendor/employee/partner custom hidden field (custentity_2663_eft_file_format) if there are no primary details
                                    if (getPrimaryEntityBankDetails(parentRecField, parentRecordId, recId).length ===0) {
                                        parentRec =  nsRecord.load({ type : parentRecType, id : parentRecordId });
                                        parentRec.setValue('custentity_2663_eft_file_format', '');
                                        // 9572 Update clear entity fields for GE
                                        if(isGEAccount){
                                            updateGEEntityFields(EFT, parentRec, '', '');
                                        }
                                        isFieldEdited = true;
                                    }
                                }

                                if(isGEAccount){
                                    var selectSubsidiary = commonLib.getFieldValue(currRecord, oldRecord, 'custrecord_9572_subsidiary');
                                    var eBankEntityType = commonLib.getFieldValue(currRecord, oldRecord,'custrecord_2663_entity_bank_type');
                                    var eBankFileFormat = commonLib.getFieldValue(currRecord, oldRecord,'custrecord_2663_entity_file_format');

                                    //If a subsidiary of a primary bank is being updated via mass update, then update the GE Entity Fields with new values.
                                    if(!isInactive && (Number(eBankEntityType) === 1)){
                                        if(!commonLib.isNullorEmpty(selectSubsidiary)){
                                            updateGEEntityFields(EFT, parentRec, selectSubsidiary, eBankFileFormat);
                                        }else{
                                            updateGEEntityFields(EFT, parentRec, '', '');
                                        }

                                    }
                                    isFieldEdited = true;
                                }
                                if(isFieldEdited){
                                    parentRec.save();
                                }
                            }
                        }
                    }
                    if(parentRecType == CUSTOMER){
                        setDDEntityFields(context, parentRecType, oldRecord, type, isGEAccount, currRecord);//Passing currRecord(context.newRecord) in case File Format is modified in XEDIT, new one will be used to set DD File Format.
                    }else if(parentRecType == CUSTOMER_REFUND){
                        setCREntityFields(context, parentRecType, oldRecord, type, isGEAccount, currRecord);//Passing currRecord(context.newRecord) in case File Format is modified in XEDIT, new one will be used to set DD File Format.
                    }
                }
            }
        }

        function isInArray(val, arr) {
            var inArray = false;
            if (val && arr) {
                for (var i =0, ii = arr.length; i < ii; i++) {
                    if (arr[i] == val) {
                        inArray = true;
                        break;
                    }
                }
            }
            return inArray;
        }

        function getPrimaryEntityBankDetails(parentRecField, parentRecId, recId) {
            var filtersObj = [];
            filtersObj.push( [ parentRecField, 'anyof',  parentRecId ] );
            filtersObj.push( 'and' );
            filtersObj.push( [ 'custrecord_2663_entity_bank_type' ,  'anyof', '1' ] );// primary type
            filtersObj.push( 'and' );
            filtersObj.push( [ 'internalid' ,  'noneof', recId ] ); // except this record

            var ite = search.create({type : 'customrecord_2663_entity_bank_details', filters : filtersObj}).getIterator();
            var searchResults = [];
            while(ite.hasNext()){
                searchResults.push(ite.next());
            }
            return searchResults;
        }

        function beforeLoad_Zengin(record, form) {

            if (paymentFileTemplate == 'Zengin') {
                // disable customer code if eft is unchecked
                var isEft = record.getValue('custrecord_2663_edi');
                if (!isEft) {
                    var custCodeFld = form.getField(fieldPrefix + 'custrecord_2663_customer_code');
                    custCodeFld.updateDisplayType(({displayType: 'disabled'}));
                    custCodeFld.defaultValue = '';
                    record.setValue('custrecord_2663_customer_code', '');
                }
            }
        }

        function beforeLoad_SEPA_DD(record, form) {
            var fileFormatName = paymentFileTemplate; //record.getText('custpage_2663_entity_file_format');
            var fld;

            if (['SEPA Direct Debit (Germany)', 'SEPA Direct Debit (CBI)', 'SEPA Direct Debit (ABN AMRO)'].indexOf(fileFormatName) > -1) {
                // disable customer code if eft is unchecked
                var refAmendment = record.getValue('custrecord_2663_entity_ref_amended');

                switch (refAmendment) {
                    case AMEND_MANDATE_ID: {
                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_name');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_bank_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED }));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_issuer_num');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.NORMAL }));

                        break;
                    }
                    case AMEND_DEBTOR_ACCT : {
                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_name');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_issuer_num');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_bank_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));
                        break;
                    }
                    case AMEND_CREDITOR_ID: {
                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_issuer_num');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));
                        break;
                    }
                    default : {
                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_issuer_num');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_acct_name');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));

                        fld = form.getField(fieldPrefix + 'custrecord_2663_entity_bank_no');
                        fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.DISABLED}));
                        break;
                    }
                }
            }

            if (['SEPA Direct Debit (ABN AMRO)'].indexOf(fileFormatName) > -1) {
                var billingSequenceType = record.getValue(CUSTRECORD_BILL_SEQ_TYPE);
                var firstPayDate = record.getValue(CUSTRECORD_FIRST_PAY_DATE);

                if((billingSequenceType == BILL_SEQ_RCUR) && firstPayDate){
                    fld = form.getField(CUSTRECORD_FIRST_PAY_DATE);
                    fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.NORMAL})); //since this field is hidden by default, it needs to be set as normal first to make it appear per Help Docs.
                    fld.updateDisplayType(({displayType: serverWidget.FieldDisplayType.INLINE}));
                }
            }
        }

        function isBICValid(bic) {
            if (bic && typeof bic == 'string') {
                var bankCode = bic.substr(0, 4);
                var countryCode = bic.substr(4, 2).toUpperCase();
                var locationCode = bic.substr(6, 2);
                var branchCode = bic.substr(8);
                if ([8, 11].indexOf(bic.length) > -1 &&	//Check if BIC length is 8 or 11
                    /^[a-zA-Z ]+$/.test(bankCode) &&	//Check if bank code only contains alphabetic characters
                    constants.VALID_COUNTRY_CODES.indexOf(countryCode) > -1 && //Check if county code is a valid ISO country code
                    /^[1-9a-zA-Z ]+$/.test(locationCode) &&	//Check if location code does not contain special characters and 0
                    /^[0-9a-zA-Z ]*$/.test(branchCode)) {	//Check if branch code does not contain special characters
                    return true;
                }
            }

            return false;
        }

        function beforeSubmit(context) {
            var executionContext = runtime.executionContext;
            var type = context.type;
            var currRecord = context.newRecord;
            var oldRecord = context.oldRecord;

            var parentRecType = getParentRecType(currRecord);
            var isCreateOrEditMode = type == context.UserEventType.CREATE || type == context.UserEventType.EDIT;

            var MSGS = translationWrapper.getTranslation(translationWrapper.PAGE.ENTITY_BANK_BS);
            var names = MSGS.names;

            if (parentRecType == 'partner') {
                var partnerId = currRecord.getValue('custrecord_2663_parent_partner');

                if (isCreateOrEditMode && isPartnerCommisionsEnabled() && partnerId) {
                    var srch = search.lookupFields({ type : 'partner', id : partnerId, columns : [ 'eligibleforcommission' ] });
                    var isEligibleForCommission =  srch.eligibleforcommission;
                    if (isEligibleForCommission) {
                        //set the parent vendor to the partner as well
                        currRecord.setValue('custrecord_2663_parent_vendor', partnerId);
                    }
                }
            }

            //Start - Secondary bank: additional field validation of the required field.
            var parentRecField = 'custrecord_2663_parent_' + parentRecType;
            if(parentRecType){
                //validation not performed when entity bank is inactive.
                var isinactive = currRecord.getValue('isinactive');
                if( !isinactive &&
                    !isUniqueEntityBankName( currRecord.getValue(BANK_NAME), currRecord.getValue(parentRecField), getAllEntityParents(currRecord), currRecord.id ) ){
                    //instead of error page, make this a banner.
                    throw customError({
                        name : names.messages.EP_00114,
                        message : MSGS[names.messages.EP_00114],
                        notifyOff : true
                    });
                }
            }
            //End - Secondary bank

            //nacha changes start
            var paymentFileFormatId = currRecord.getValue('custrecord_2663_entity_file_format');
            var acctNumber = currRecord.getValue('custpage_eft_custrecord_2663_entity_acct_no');
            var csvflag=executionContext.toString().toLowerCase() === 'csvimport';
            if(acctNumber==undefined){
                acctNumber = currRecord.getValue('custrecord_2663_entity_acct_no');
            }
            var encryptAccNumFlag=fileFormatDAO.isEncryptAccNumEnabled(paymentFileFormatId);
            var isXeditOrEditMode = type == 'xedit' || type == context.UserEventType.EDIT;
            if(type != context.UserEventType.CREATE) {
                var oldAcctNumber = oldRecord.getValue('custrecord_2663_entity_acct_no');
            }
            if(type === context.UserEventType.CREATE || (isXeditOrEditMode && oldAcctNumber!=acctNumber && acctNumber!='')||(isXeditOrEditMode && oldAcctNumber===acctNumber && (executionContext.toString().toLowerCase()==='userinterface'|| !currRecord.getValue('custrecord_15152_is_acc_num_encrypted')))){
                encryptAccNum(encryptAccNumFlag,acctNumber,currRecord);
            }
            //nacha changes end

            if (csvflag) {

                if (isCreateOrEditMode) {
                    var prefix;
                    var accountNum;
                    var bic;
                    var ibanString;
                    var countryCode;
                    //sonar fix duplicate code see line number- 1042
                    //  var paymentFileFormatId = currRecord.getValue('custrecord_2663_entity_file_format');

                    var csv_subsidiary_value = currRecord.getValue('custrecord_9572_subsidiary');
                    if (!commonLib.isNullorEmpty(csv_subsidiary_value)) {
                        if (([EMPLOYEE, PARTNER].indexOf(parentRecType) > -1 || !commonLib.isGlobalEntityFeatureEnabled(parentRecType))) {
                            // update subsidiary value to null since for employee/partner/SI accounts, the subsidiary should not be updated in entity bank details
                            currRecord.setValue('custrecord_9572_subsidiary', '');
                        } else {
                            checkSubsidiaryListCSV(currRecord, parentRecType, parentRecField, MSGS, csv_subsidiary_value);
                        }
                    }

                    //Load text representation of paymentFileFormat
                    var paymentFileFormat = getFileFormatName(paymentFileFormatId);

                    if (['CBI Payments', 'AEB - Norma 34', 'CBI Collections','SEPA Credit Transfer (Austria)',
                        'SEPA Credit Transfer (Belgium)', 'SEPA Credit Transfer (France)', 'SEPA Credit Transfer (Netherlands)',
                        'SEPA (Austria) Pain.001.001.02', 'SEPA Credit Transfer (ABN AMRO)', 'SEPA Credit Transfer (Germany)',
                        'SEPA Credit Transfer (CBI)', 'SEPA Direct Debit (CBI)', 'SEPA Credit Transfer (Bank of Ireland)',
                        'SEPA Direct Debit (ABN AMRO)'].indexOf(paymentFileFormat) > -1) {

                        ibanString = currRecord.getValue('custrecord_2663_entity_iban');

                        if (['SEPA Credit Transfer (ABN AMRO)', 'SEPA Credit Transfer (Germany)', 'SEPA Credit Transfer (CBI)',
                            'SEPA Direct Debit (CBI)', 'SEPA Credit Transfer (Bank of Ireland)', 'SEPA Direct Debit (ABN AMRO)'].indexOf(paymentFileFormat) > -1) {
                            if (/[a-z]/.test(ibanString)) {
                                ibanString = ibanString.toUpperCase();
                                currRecord.setValue('custrecord_2663_entity_iban', ibanString, false);
                            }
                        }

                        ibanValidator.setIBAN(ibanString);
                        if (ibanValidator.getValue() && ibanValidator.isValid()) {
                            currRecord.setValue('custrecord_2663_entity_country_code', ibanValidator.getCountryCode(), false);
                            currRecord.setValue('custrecord_2663_entity_iban_check', ibanValidator.getCheckDigits(), false);
                            //Set derived values
                            if (['CBI Payments', 'CBI Collections'].indexOf(paymentFileFormat) > -1) {
                                currRecord.setValue('custrecord_2663_entity_country_check', ibanValidator.getDerivedValue(1), false);
                                currRecord.setValue('custrecord_2663_entity_bank_no', ibanValidator.getDerivedValue(2), false);
                                currRecord.setValue('custrecord_2663_entity_branch_no', ibanValidator.getDerivedValue(3), false);
                                currRecord.setValue('custrecord_2663_entity_acct_no', ibanValidator.getDerivedValue(4), false);
                            }
                            else if (paymentFileFormat == 'AEB - Norma 34') {
                                currRecord.setValue('custrecord_2663_entity_bank_no', ibanValidator.getDerivedValue(1), false);
                                currRecord.setValue('custrecord_2663_entity_branch_no', ibanValidator.getDerivedValue(2), false);
                                currRecord.setValue('custrecord_2663_entity_country_check', ibanValidator.getDerivedValue(3), false);
                                currRecord.setValue('custrecord_2663_entity_acct_no', ibanValidator.getDerivedValue(4), false);
                            } else if (['SEPA Credit Transfer (Austria)', 'SEPA Credit Transfer (Belgium)', 'SEPA Credit Transfer (France)',
                                'SEPA Credit Transfer (Netherlands)', 'SEPA (Austria) Pain.001.001.02', 'SEPA Credit Transfer (ABN AMRO)',
                                'SEPA Credit Transfer (Germany)', 'SEPA Credit Transfer (CBI)', 'SEPA Direct Debit (CBI)',
                                'SEPA Credit Transfer (Bank of Ireland)'].indexOf(paymentFileFormat) > -1) {
                                if (['SEPA Credit Transfer (CBI)', 'SEPA Direct Debit (CBI)'].indexOf(paymentFileFormat) > -1 && ibanValidator.getCountryCode() != 'IT') {
                                    throw customError({
                                        name : names.messages.EP_00094,
                                        message : MSGS[names.messages.EP_00094],
                                        notifyOff : true
                                    });
                                }

                                bic = currRecord.getValue('custrecord_2663_entity_bic') || '';
                                if (!isBICValid(bic)) {
                                    throw customError({
                                        name : names.messages.EP_00095,
                                        message : MSGS[names.messages.EP_00095],
                                        notifyOff : true
                                    });
                                }


                            }
                        } else {
                            throw customError({
                                name : names.messages.EP_00096,
                                message : MSGS[names.messages.EP_00096],
                                notifyOff : true
                            });
                        }
                    }
                    else if (['ACH - CCD/PPD', 'ACH - CTX (Free Text)', 'ACH - PPD'].indexOf(paymentFileFormat) > -1) {
                        commonLib.setACH(currRecord.getValue('custrecord_2663_entity_bank_no'));
                        if (commonLib.isValidRoutingNumber()) {
                            currRecord.setValue('custrecord_2663_entity_processor_code', commonLib.getFederalReserveRoutingSymbol());
                            currRecord.setValue('custrecord_2663_entity_bank_code', commonLib.getABAInstitutionIdentifier());
                            currRecord.setValue('custrecord_2663_entity_country_check', commonLib.getCheckDigit());
                        }
                        else {
                            throw customError({
                                name : names.messages.EP_00097,
                                message : MSGS[names.messages.EP_00097],
                                notifyOff : true
                            });
                        }
                    }
                    else if (paymentFileFormat == 'DTAUS') {
                        var bankNumber = currRecord.getValue('custrecord_2663_entity_bank_no');
                        var accountNumber = currRecord.getValue('custrecord_2663_entity_acct_no');

                        var iban = '';
                        if (bankNumber && accountNumber) {
                            iban = ibanValidator.generateFromBankAndAccountNum(bankNumber, accountNumber, 'DE');
                        }
                        currRecord.setValue('custrecord_2663_entity_iban', iban);
                    }
                    else if (paymentFileFormat == 'Raiffeisen Domestic Transfer') {
                        ibanValidator.setBBAN('HU', currRecord.getValue('custrecord_2663_entity_bban'));
                        if (ibanValidator.getBBANValue() && ibanValidator.isBBANValid() ) {
                            //Set derived values
                            currRecord.setValue('custrecord_2663_entity_bank_no', ibanValidator.getBBANDerivedValue('bank_number'), false);
                            currRecord.setValue('custrecord_2663_entity_branch_no', ibanValidator.getBBANDerivedValue('branch_number'), false);
                            currRecord.setValue('custrecord_2663_entity_acct_no', ibanValidator.getBBANDerivedValue('account_number'), false);
                        }
                        else {
                            throw customError({
                                name : names.messages.EP_00098,
                                message : MSGS[names.messages.EP_00098],
                                notifyOff : true
                            });
                        }
                    }
                    else if (paymentFileFormat == 'ASB' || paymentFileFormat == 'Westpac - Deskbank') {
                        prefix = 'custrecord_2663_entity_';

                        //get the account number
                        accountNum = currRecord.getValue(prefix + 'bban');

                        if (!commonLib.isNullorEmpty(accountNum)) {
                            //populate other fields
                            commonLib.setNZAccountNumber(accountNum);
                            currRecord.setValue(prefix + 'bank_no', commonLib.getBankNumber());
                            currRecord.setValue(prefix + 'branch_no', commonLib.getBranchNumber());
                            currRecord.setValue(prefix + 'acct_no', commonLib.getUniqueAccountNumber());
                            currRecord.setValue(prefix + (paymentFileFormat == 'ASB' ? 'bank_code' : 'acct_suffix'), commonLib.getBankAccountSuffix());
                        } else {
                            throw customError({
                                name : names.messages.EP_00100,
                                message : MSGS[names.messages.EP_00100],
                                notifyOff : true
                            });
                        }
                        // check payment description
                        if (!isValidMaxLength(currRecord, 'custrecord_2663_entity_payment_desc', 12)){
                            throw customError({
                                name : names.messages.EP_00099,
                                message : MSGS[names.messages.EP_00099],
                                notifyOff : true
                            });
                        }

                    }
                    else if (paymentFileFormat == 'ANZ') {
                        prefix = 'custrecord_2663_entity_';

                        //pad the account number suffix if length is less than 16
                        //get the account number
                        accountNum = currRecord.getValue(prefix + 'bban');

                        if (!commonLib.isNullorEmpty(accountNum) && accountNum.length == 15) {
                            var newAccountNum = accountNum.substring(0, 13) + '0' + accountNum.substring(13);
                            currRecord.setValue('custrecord_2663_entity_bban', newAccountNum, false, false);
                        } else {
                            throw customError({
                                name : names.messages.EP_00100,
                                message : MSGS[names.messages.EP_00100],
                                notifyOff : true
                            });
                        }

                        // check payment description
                        if (!isValidMaxLength(currRecord, 'custrecord_2663_entity_payment_desc', 12)){
                            throw customError({
                                name : names.messages.EP_00099,
                                message : MSGS[names.messages.EP_00099],
                                notifyOff : true
                            });
                        }
                    }
                    else if (paymentFileFormat == 'BNZ') {
                        if (!isValidMaxLength(currRecord, 'custrecord_2663_reference', 12) || !isValidMinLength(currRecord, 'custrecord_2663_reference', 0)){
                            throw customError({
                                name : names.messages.EP_00101,
                                message : MSGS[names.messages.EP_00101],
                                notifyOff : true
                            });
                        }
                        /*else if (!isValidMinLength(currRecord, 'custrecord_2663_reference', 0)){
                            throw customError({
                                name : names.messages.EP_00101,
                                message : MSGS[names.messages.EP_00101],
                                notifyOff : true
                            });
                        }*/
                        else if (!isValidMaxLength(currRecord, 'custrecord_2663_customer_code', 12)){
                            throw customError({
                                name : names.messages.EP_00102,
                                message : MSGS[names.messages.EP_00102],
                                notifyOff : true
                            });
                        }
                        else if (!isValidMaxLength(currRecord, 'custrecord_2663_entity_payment_desc', 12)){
                            throw customError({
                                name : names.messages.EP_00099,
                                message : MSGS[names.messages.EP_00099],
                                notifyOff : true
                            });
                        }
                    }
                    else if (paymentFileFormat == 'J.P. Morgan Freeform GMT'){
                        bic = currRecord.getValue('custrecord_2663_entity_bic') || '';

                        if (!isBICValid(bic)) {
                            throw customError({
                                name : names.messages.EP_00095,
                                message : MSGS[names.messages.EP_00095],
                                notifyOff : true
                            });
                        }

                        countryCode = bic.substr(4, 2).toUpperCase();

                        if(countryCode){
                            currRecord.setValue('custrecord_2663_entity_country_code', countryCode);
                        }

                    }
                    else if (paymentFileFormat == 'SEPA Credit Transfer (Luxembourg)'){
                        // check bic
                        bic = currRecord.getValue('custrecord_2663_entity_bic') || '';
                        if (!bic){
                            throw customError({
                                name : names.messages.EP_00102,
                                message : MSGS[names.messages.EP_00102],
                                notifyOff : true
                            });
                        }
                        if (!isBICValid(bic)) {
                            throw customError({
                                name : names.messages.EP_00095,
                                message : MSGS[names.messages.EP_00095],
                                notifyOff : true
                            });
                        }

                        // check iban
                        ibanString = currRecord.getValue('custrecord_2663_entity_iban');
                        if (!ibanString){
                            throw customError({
                                name : names.messages.EP_00104,
                                message : MSGS[names.messages.EP_00104],
                                notifyOff : true
                            });
                        }
                        ibanValidator.setIBAN(ibanString);
                        if (!(ibanValidator.getValue() && ibanValidator.isValid())) {
                            throw customError({
                                name : names.messages.EP_00095,
                                message : MSGS[names.messages.EP_00095],
                                notifyOff : true
                            });
                        }
                    }
                    else if (paymentFileFormat == 'DTAZV'){
                        ibanString = currRecord.getValue('custrecord_2663_entity_iban');
                        if (!ibanString){
                            throw customError({
                                name : names.messages.EP_00104,
                                message : MSGS[names.messages.EP_00104],
                                notifyOff : true
                            });
                        }
                        ibanValidator.setIBAN(ibanString);
                        if (!(ibanValidator.getValue() && ibanValidator.isValid())) {
                            throw customError({
                                name : names.messages.EP_00095,
                                message : MSGS[names.messages.EP_00095],
                                notifyOff : true
                            });
                        }

                        countryCode = ibanValidator.getCountryCode().toUpperCase();

                        if(countryCode){
                            currRecord.setValue('custrecord_2663_entity_country_code', countryCode);
                        }

                    }
                    else if (paymentFileFormat == 'HSBC ISO 20022 (Singapore)'){
                        // check account number
                        var acctNo = currRecord.getValue('custrecord_2663_entity_acct_no') || '';
                        if (!acctNo){
                            throw customError({
                                name : names.messages.EP_00105,
                                message : MSGS[names.messages.EP_00105],
                                notifyOff : true
                            });
                        }
                        // check bank code
                        var bankCode = currRecord.getValue('custrecord_2663_entity_bank_code') || '';
                        if (!bankCode){
                            throw customError({
                                name : names.messages.EP_00106,
                                message : MSGS[names.messages.EP_00106],
                                notifyOff : true
                            });
                        }
                        // check branch number
                        var branchNo = currRecord.getValue('custrecord_2663_entity_branch_no') || '';
                        if (!branchNo){
                            throw customError({
                                name : names.messages.EP_00107,
                                message : MSGS[names.messages.EP_00107],
                                notifyOff : true
                            });
                        }
                        // check bank name
                        var bankName = currRecord.getValue('custrecord_2663_entity_bank_name') || '';
                        if (!bankName){
                            throw customError({
                                name : names.messages.EP_00108,
                                message : MSGS[names.messages.EP_00108],
                                notifyOff : true
                            });
                        }
                    }
                }
            }
            //Nacha encryption for inline editing
            if(paymentFileFormatId==='' && acctNumber!='' && type === 'xedit'){
                paymentFileFormatId = oldRecord.getValue('custrecord_2663_entity_file_format');
                encryptAccNumFlag=fileFormatDAO.isEncryptAccNumEnabled(paymentFileFormatId);
                encryptAccNum(encryptAccNumFlag,acctNumber,currRecord);
            }
        }

        function encryptAccNum(encryptAccNumFlag,acctNumber,currRecord) {
            if(encryptAccNumFlag){
                var param={
                    text:acctNumber,
                };
                var encryptResult=cipherUtil.encrypt(param);
                log.debug('encryptResult',JSON.stringify(encryptResult));
                if(encryptResult.result){
                    currRecord.setValue('custrecord_2663_entity_acct_no',encryptResult.result);
                    currRecord.setValue('custrecord_15152_is_acc_num_encrypted',true);
                }else{
                    currRecord.setValue('custrecord_15152_is_acc_num_encrypted',false);
                    log.error('#10782_entity_bank_details#whileEncryptingAccountNumber','ENCRYPTION_ERROR'+JSON.stringify(encryptResult));
                }

            }else{
                currRecord.setValue('custrecord_15152_is_acc_num_encrypted',false);
            }
        }

        function isUniqueEntityBankName(bankName, entityId, parents, entityBankId){

            //value must be unique.
            var result = true;

            if(parents && parents.length > 0){
                //get all the entity banks of all its parent.

                var filtersObj = [];
                parents.map(function(el){
                    var parentRecField =  'custrecord_2663_parent_' + el.recType;
                    filtersObj.push([ parentRecField, 'anyof',  el.id ]);
                    filtersObj.push( 'and' );
                });
                filtersObj.push( ['name', 'is', bankName ] );
                filtersObj.push( 'and' );
                filtersObj.push( ['isinactive', 'is',   'F' ] );

                if(entityBankId){ //exclude self in the search
                    filtersObj.push( 'and' );
                    filtersObj.push( [ 'internalid', 'noneof', entityBankId ] );
                }

                var columnObj =  [ 'name' , 'internalid' ];
                var searchResult = search.create({ type : 'customrecord_2663_entity_bank_details',
                    columns : columnObj, filters : filtersObj})
                    .run().getRange({start : 0, end : 10});

                log.debug('isUniqueEntityBankName::', JSON.stringify(searchResult));
                if(searchResult && searchResult.length > 0){
                    result = false;
                }
            }

            return result;
        }

        function getParentRecType(record) {
            var parentRecType = '';
            if (isPartnerCommisionsEnabled() && record.getValue('custrecord_2663_parent_partner')) {
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

        /**
         * Create payment file format list based on format type (EFT/DD)
         *
         * @param {Object} form
         * @param {String} initFileFormatId
         */

        function createPaymentFileFormatList(record, form, MSGS, names, initFileFormatId) {

            //get and hide the custom form field
            var customFormFld = record.getField('customform');
            customFormFld.isDisplay = false;


            //get and hide the original field
            var origFileFormatFld = record.getField('custrecord_2663_entity_file_format');
            origFileFormatFld.isDisplay = false;

            // add field for payment file format depending on entity type
            var fileFormatFld = form.addField({
                id: 'custpage_2663_entity_file_format',
                type: 'select',
                label: MSGS[names.labels.fileformat]
            });
            fileFormatFld.isMandatory = true;
            fileFormatFld.setHelpText(MSGS[names.flh.fileformat]);

            form.insertField( fileFormatFld, 'custrecord_2663_entity_bank_type');
            if (origFileFormatFld.helpText) {
                fileFormatFld.setHelpText(origFileFormatFld.helpText);
            }

            // fill dropdown based on entity type and license availability
            var parentRecType = getParentRecType(record);
            var allowedFormats;
            if (parentRecType == 'vendor' || parentRecType == 'employee' || parentRecType == 'cust_ref' ||
                (isPartnerCommisionsEnabled() && parentRecType == 'partner')) {
                // eft
                allowedFormats = formatRestrictor.getAllowedFormats({
                    formatType: EFT_PAYMENT_TYPE,
                    country: getCountry(),
                    isLicensed: commonLib.hasLicense()
                });
            }
            else if (parentRecType == 'customer') {
                // dd
                allowedFormats = formatRestrictor.getAllowedFormats({
                    formatType: DD_PAYMENT_TYPE,
                    country: getCountry(),
                    isLicensed: commonLib.hasLicense()
                });
            }
            if (allowedFormats) {
                var ctr = 0;
                var selected = false;
                var selectedFormat;
                for (var j in allowedFormats) {
                    if (ctr == 0 || allowedFormats[j].id == initFileFormatId) {
                        selectedFormat = allowedFormats[j];  // selects first format as default, reselects initFileFormatId if found
                        if(allowedFormats[j].id == initFileFormatId){
                            selected = true;
                        }
                    }else{
                        selected = false;
                    }
                    fileFormatFld.addSelectOption({ value : allowedFormats[j].id, text : allowedFormats[j].name,
                        isSelected : selected });
                    ctr++;
                }
                log.debug('selectedFormat', JSON.stringify(selectedFormat) );
                if( selectedFormat != null && selectedFormat != undefined ){
                    paymentFileTemplate = selectedFormat.name;
                    fileFormatFld.defaultValue = selectedFormat.name;
                    record.setValue('custpage_2663_entity_file_format', selectedFormat.id);
                }
            }
        }

        function getCountry(){
            var companyInfo = config.load({ type: config.Type.COMPANY_INFORMATION });
            var country = companyInfo.getValue({
                fieldId: 'country'
            });

            return country;
        }

        var paymentFileTemplate;
        /**
         * Display specified reference fields for the Payment File Template
         *
         * @param {String} paymentFileTemplateId
         */
        function displayReferenceFields(form, record, paymentFileTemplateId,type){
            if (paymentFileTemplateId) {

                log.debug('displayReferenceFields', 'paymentFileTemplateid:::' + paymentFileTemplateId);
                var refFields = fileFormatDAO.getEntityReferenceFields(paymentFileTemplateId);

                //551552 - Creating custom page objects to display customized label, help text as in Payment File Format
                var customRecord =  loadCustomRecord('customrecord_2663_entity_bank_details');
                var sublistId = 'customfield';

                // var sForm =  serverWidget.wrapForm(form);
                // get custom fields under custom record
                var fieldSublistCnt = customRecord.getLineCount({sublistId : sublistId });

                for (var lineNum = 0; lineNum < fieldSublistCnt; lineNum++) {

                    var fieldName = customRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'fieldcustcodeid',
                        line: lineNum
                    });

                    var customFieldId = customRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: 'fieldid',
                        line: lineNum
                    });

                    if (refFields.hasOwnProperty(fieldName)) {

                        var refField = refFields[fieldName];
                        var fieldObj = nsRecord.load({
                            type: 'customrecordcustomfield',
                            id: customFieldId,
                            isDynamic: true,
                        });

                        var fieldType = fieldObj.getValue('fieldtype').toLowerCase();
                        var sourceOrRadio;
                        if (fieldType == 'select') {
                            sourceOrRadio = fieldObj.getValue('fldcurselrectype');
                        }
                        if(fieldType== 'clobtext'){
                            fieldType = 'longtext';
                        }

                        try{
                            //nacha changes
                            var defaultValue;
                            defaultValue=record.getValue(fieldName)
                            if(fieldName==='custrecord_2663_entity_acct_no'){
                                defaultValue=decryptAccountNumber(record,type);
                            }

                            // create fields on form
                            var newField = addField(form, {
                                id: fieldPrefix + fieldName,
                                defaultValue: defaultValue,
                                type: fieldType,
                                source: sourceOrRadio ,
                                mandatory: refField['mandatory'] == 'true',
                                displayType: refField['displaytype'],
                                helpText: refField['helptext'],
                                label: refField['label'],
                                container: null
                            });

                            record.setValue(fieldPrefix + fieldName , defaultValue);
                            form.insertField( newField, fieldName );
                        }catch(err){
                            log.error(err.name, fieldName + '++' + err.message);
                        }
                    }
                }
            }
        }

        /**
         * [addField description]
         * @param {[type]} params [description]
         */
        function addField(form, params){
            log.debug('addField params', params);
            try {
                var newField = form.addField({
                    id: params.id,
                    type: params.type,
                    label: params.label,
                    source: params.source,
                    container: params.container,
                });

                if(params.mandatory){
                    newField.isMandatory = params.mandatory;
                }

                if(params.displayType){
                    newField.updateDisplayType({displayType: params.displayType});
                }

                if(params.helpText){
                    newField.setHelpText({help: params.helpText});
                }

                if(params.type == serverWidget.FieldType.CHECKBOX){
                    params.defaultValue = params.defaultValue ? 'T': 'F';
                }

                if(params.defaultValue){
                    newField.defaultValue  = params.defaultValue;
                }

                return newField;
            } catch (addFieldEx) {
                var errorMessage = ['EP_00047', 'Error encountered while adding field with id: ' + params.id + ' to the form.'].join(' - ')
                log.error('Entity Bank Details UE', errorMessage +  ' \n actualError: '+ addFieldEx.message);
            }

        }

        /**
         * Hide all fields
         *
         * @param {Array} fldsToExclude
         */
        function hideAllFields(form, fldsToExclude){
            // get custom record type by filtering with name with format "Entity Bank Details"
            var recordType = loadCustomRecord('customrecord_2663_entity_bank_details');
            // get custom fields under custom record
            var customFldCnt = recordType.getLineCount({sublistId : 'customfield' });

            for (var lineNum = 0; lineNum < customFldCnt; lineNum++) {
                var fldId = recordType.getSublistValue({
                    sublistId: 'customfield',
                    fieldId: 'fieldcustcodeid',
                    line: lineNum
                });

                if (fldsToExclude.indexOf(fldId) < 0) {
                    form.getField(fldId).updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.HIDDEN
                    }) ;
                }
            }
            form.getField('customform').updateDisplayType({
                displayType : serverWidget.FieldDisplayType.HIDDEN
            }) ;
        }

        function loadCustomRecord(recordType){

            var ite = search.create({
                type: 'customrecordtype',
                filters: [ ['scriptid', 'is', recordType ] ],
                columns : [ 'internalid' ]
            }).getIterator();

            var internalId;
            while(ite.hasNext()){
                var res = ite.next();
                internalId = res.id;
            }

            var customRecordType = nsRecord.load({
                type: 'customrecordtype',
                id: internalId,
                isDynamic: true,
            });

            return customRecordType;
        }

        function isPartnerCommisionsEnabled() {
            var featureInEffect = runtime.isFeatureInEffect({
                feature: 'PARTNERCOMMISSIONS'
            });
            return featureInEffect;
        }


        function isValidMaxLength(record, fieldId, maxLength){
            var value = record.getValue(fieldId) || '';
            if (value.length <= maxLength)
                return true;
            return false;
        }
        function isValidMinLength(record, fieldId, minLength){
            var value = record.getValue(fieldId) || '';
            if (value.length > minLength)
                return true;
            return false;
        }

        function customError(params){
            return params.message;
        }

        /**
         * Gets the Name of the File Format from the internal ID.
         * @param fileFormatId
         * @returns {*}
         */
        function getFileFormatName(fileFormatId){
            var fileFormatName = '';
            if(fileFormatId){
                var searchObject = search.lookupFields({
                    type : CUSTOMRECORD_FILE_FORMAT,
                    id : fileFormatId,
                    columns : 'name'
                });

                fileFormatName = searchObject.name ? searchObject.name : '';
            }
            else return fileFormatName;

            return fileFormatName;
        }

        /**
         * Decrypt Account Number.
         * @param record , type
         * @returns {Number}
         */
        function decryptAccountNumber(record,type){
            var acctNumber = record.getValue('custrecord_2663_entity_acct_no');
            var encryptionFlag=record.getValue('custrecord_15152_is_acc_num_encrypted');
            if(type == 'edit' && encryptionFlag){
                var decryptResult=cipherUtil.decrypt(JSON.parse(acctNumber));
                log.debug('decryptResult',decryptResult);
                if(decryptResult.result){
                    acctNumber=decryptResult.result;
                }else{
                    log.error('#10782_entity_bank_details#whiledecryptingAccountNumber','DECRYPTION_ERROR'+JSON.stringify(decryptResult));
                }
            }
            return acctNumber;
        }

        return {
            beforeLoad: beforeLoad,
            afterSubmit: afterSubmit,
            beforeSubmit: beforeSubmit
        };

    });
