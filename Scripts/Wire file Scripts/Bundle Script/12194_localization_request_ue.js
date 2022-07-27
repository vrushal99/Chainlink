/**
 * Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.
 * otherwise make available this code.
 *
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['../../lib/wrapper/9997_NsWrapperRuntime', '../../lib/translation/7716_translationWrapper_ss2',  '../../lib/wrapper/9997_NsWrapperMessage'],

    /**
     * @param runtime
     */
    function (runtime, translator, message) {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
            var execContext = runtime.executionContext;
			var locale = runtime.getCurrentUser().getPreference('LANGUAGE');
            // When in UI, only view is allowed
            if(execContext === runtime.ContextType.USER_INTERFACE && scriptContext.type !== scriptContext.UserEventType.VIEW){
                var MSGMAP = translator.getTranslation(translator.PAGE.TEMPLATE_REQUEST,locale);
                var names = MSGMAP.names;
                message.warnUE(MSGMAP[names.ui.warnmsg], MSGMAP[names.messages.crudnotallowed]);
            }
        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {
            var execContext = runtime.executionContext;
			var locale = runtime.getCurrentUser().getPreference('LANGUAGE');
            if(execContext === runtime.ContextType.USER_INTERFACE){
                var MSGMAP = translator.getTranslation(translator.PAGE.TEMPLATE_REQUEST,locale);
                var names = MSGMAP.names;
                throw MSGMAP[names.messages.crudnotallowed];
            }
        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            var execContext = runtime.executionContext;
			var locale = runtime.getCurrentUser().getPreference('LANGUAGE');
            if(execContext === runtime.ContextType.USER_INTERFACE){
                var MSGMAP = translator.getTranslation(translator.PAGE.TEMPLATE_REQUEST,locale);
                var names = MSGMAP.names;
                throw MSGMAP[names.messages.crudnotallowed];
            }
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });