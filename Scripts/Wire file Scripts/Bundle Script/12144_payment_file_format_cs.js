/**
 * Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.
 *
 * @NApiVersion 2.0
 * @NScriptType ClientScript
 */

define(['../../lib/wrapper/9997_NsWrapperMessage', '../../lib/wrapper/9997_NsWrapperRuntime', '../../lib/wrapper/9997_NsWrapperDialog'],

    function (message, runtime, dialog) {

		function pageInit(scriptContext) {
          var record = scriptContext.currentRecord;

          var suitetaxField = record.getValue({ fieldId: 'custrecord_12144_free_marker_body_st' });
          var isSuitetax = runtime.isSuiteTaxEnabled();

		  if (['copy', 'create', 'edit'].indexOf(scriptContext.mode) > -1
                && (isSuitetax && !suitetaxField)) {
          	var msgs = record.getValue({ fieldId: 'custpage_translation_strings' });
            if (msgs) {
            	msgs = JSON.parse(msgs);
                message.warn("", msgs.warnsuitetax);
            }
          }
        }

        function fieldChanged(scriptContext) {
            var record = scriptContext.currentRecord;
          	var PAYMENT_FILE_TYPE = '2'; // Only for DD

            switch (scriptContext.fieldId) {
                case 'custrecord_12144_free_marker_body_st':
                    var isSuitetax = runtime.isSuiteTaxEnabled();
                    if (isSuitetax && record.getValue({ fieldId: 'custrecord_12144_free_marker_body_st' }) == "") {
                        var msgs = record.getValue({ fieldId: 'custpage_translation_strings' });
                        if (msgs) {
                            msgs = JSON.parse(msgs);
                            message.warn("", msgs.warnsuitetax);
                        }
                    } else {
                        message.hide();
                    }
                    break;
              case 'custrecord_2663_payment_file_type':
                var paymentType = nlapiGetFieldValue('custrecord_2663_payment_file_type');
                var sepaDDSorting = nlapiGetField('custrecord_13272_sorting_sepadd');
                if(PAYMENT_FILE_TYPE == parseInt(paymentType)) {
                   sepaDDSorting.setDisplayType('normal');
                } else {
                  sepaDDSorting.setDisplayType('disabled');
                  nlapiSetFieldValue('custrecord_13272_sorting_sepadd', 'F');
                }
                break;

                case 'custrecord_15152_encrypt_acc_num':
                     msgs = JSON.parse(record.getValue({ fieldId : 'custpage_translation_strings'}));
                    if(nlapiGetFieldValue('custrecord_15152_encrypt_acc_num') === 'T'){
                        dialog.confirm({title: msgs.warnaccountencryptiontitle, message : msgs.warnaccountencryption, callback : function(ok){ if(!ok){ nlapiSetFieldValue('custrecord_15152_encrypt_acc_num', 'F');} } });
                    }
                    break;
            }
        }

        return {
          	pageInit     : pageInit,
            fieldChanged : fieldChanged
        };
    });
