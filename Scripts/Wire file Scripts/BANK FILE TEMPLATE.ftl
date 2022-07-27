<#-- format specific processing -->

<#function buildEntityAddress entity>
<#assign address1 = entity.address1>
<#assign address2 = entity.address2>
<#assign address3 = entity.address3>
<#assign address = "">
<#if address1?has_content>
<#assign address = address + address1>
</#if>
<#if address2?has_content>
<#if address?has_content>
<#assign address = address + "," + address2>
<#else>
<#assign address = address2>
</#if>
</#if>
<#if address3?has_content>
<#if address?has_content>
<#assign address = address + "," + address3>
<#else>
<#assign address = address3>
</#if>
</#if>
<#return address>
</#function>

<#function getReferenceNote payment>
<#assign paidTransactions = transHash[payment.internalid]>
<#assign referenceNote = "">
<#assign paidTransactionsCount = paidTransactions?size>
<#if (paidTransactionsCount >= 1)>
<#list paidTransactions as transaction>
<#if transaction.tranid?has_content>
<#if referenceNote?has_content>
<#assign referenceNote = referenceNote + "," + transaction.tranid>
<#else>
<#assign referenceNote = transaction.tranid>
</#if>
</#if>
</#list>
</#if>
<#return referenceNote>
</#function>

<#function getBankAccountNumber cbank>
<#if cbank.custpage_eft_custrecord_2663_acct_num?has_content>
<#return cbank.custpage_eft_custrecord_2663_acct_num>
<#elseif cbank.custpage_eft_custrecord_2663_iban?has_content>
<#return cbank.custpage_eft_custrecord_2663_iban>
</#if>
<#return "">
</#function>

<#-- <#function getBankSenderNameAddress cbank>
<#assign address1 = cbank.custrecord_2663_subsidiary.representingvendor.address1>
<#assign address2 = cbank.custrecord_2663_subsidiary.representingvendor.address2>
<#assign address = "">
<#if address1?has_content>
<#assign address = address + address1>
</#if>
<#if address2?has_content>
<#if address?has_content>
<#assign address = address + "," + address2>
<#else>
<#assign address = address2>
</#if>
</#if>
<#return address>
</#function> -->

<#function getEntityAccountNumber ebank countrycode>
<#if ebank.custrecord_2663_entity_iban?has_content && countrycode != 'US'>
<#if countrycode == 'AU' || countrycode == 'MY' || countrycode == 'CA'|| countrycode == 'IN'>
<#return ebank.custrecord_2663_entity_acct_no>
<#else>
<#return ebank.custrecord_2663_entity_iban>
</#if>
<#elseif ebank.custrecord_2663_entity_acct_no?has_content>
<#return ebank.custrecord_2663_entity_acct_no>
</#if>
<#return "">
</#function>

<#function removeInvalidCharacter str>
<#assign firstChar = str?substring(0,1)>
<#if firstChar == ":" || firstChar == "-">
<#return str?substring(1)>
</#if>
<#return str>
</#function>


<#function splitAddr str>
<#if (str?length > 35)>
<#assign addr1 = (str?substring(0,35))>
<#if (str?length > 70)>
<#assign addr2 = (str?substring(35,70))>
<#assign addr3 = (str?substring(70,str?length))>
<#assign newAddr = addr1+'\r\n'+addr2+'\r\n'+addr3>
<#return newAddr>
<#else>
<#assign addr2 = (str?substring(35,str?length))>
<#assign newAddr = addr1+'\r\n'+addr2>
<#return newAddr>
</#if>
</#if>
<#return str>
</#function>


<#function getBankToBank pymntCurrency>
<#switch pymntCurrency>
<#case 'CAD'>
<#return "//CC">
<#case 'MYR'>
<#return "MY">
<#case 'AUD'>
<#return "AU">
<#default>
<#return ''>
</#switch>
</#function>

<#-- template building -->
#OUTPUT START#
<#list payments as payment>
<#assign ebank = ebanks[payment_index]>
<#assign entity = entities[payment_index]>
<#assign cbank = cbanks[payment_index]>
<#assign entityName = buildEntityName(entity,false)>
<#assign entityAddress = buildEntityAddress(entity)>
<#assign senderAddress = getBankSenderNameAddress(cbank)>
<#assign referenceNote = getReferenceNote(payment)>
<#assign pymntCurrency = getCurrencySymbol(payment.currency)?upper_case>
:20:${payment.tranid}
:32A:${pfa.custrecord_2663_process_date?string("yyyyMMdd")}${pfa.custrecord_2663_process_date?string("yyyyMMdd")}${pymntCurrency}<#if pymntCurrency == 'JPY'>${formatAmount(getAmount(payment),"noDec")}<#else>${formatAmount(getAmount(payment),"dec",",")}</#if>
<#if payment.exchangerate?has_content>
:36:${payment.exchangerate + 'A'}
</#if>
:50:/${getBankAccountNumber(cbank)}
<#-- ${splitAddr(removeInvalidCharacter(cbank.custrecord_2663_print_company_name))}
${splitAddr(removeInvalidCharacter(senderAddress + " " + cbank.custrecord_2663_subsidiary.representingvendor.city))}
${cbank.billcountrycode} -->
<#if (pymntCurrency == 'EUR' && (entity.billcountrycode != 'AX' && entity.billcountrycode != 'AD' && entity.billcountrycode != 'AT' && entity.billcountrycode != 'BE' && entity.billcountrycode != 'IC' && entity.billcountrycode != 'EA' && entity.billcountrycode != 'HR' && entity.billcountrycode != 'CY' && entity.billcountrycode != 'CZ' && entity.billcountrycode != 'DK' && entity.billcountrycode != 'EE' && entity.billcountrycode != 'FI' && entity.billcountrycode != 'FR' && entity.billcountrycode != 'GF' && entity.billcountrycode != 'PF' && entity.billcountrycode != 'TF' && entity.billcountrycode != 'DE' && entity.billcountrycode != 'GB' && entity.billcountrycode != 'GR' && entity.billcountrycode != 'GP' && entity.billcountrycode != 'GG' && entity.billcountrycode != 'HU' && entity.billcountrycode != 'IE' && entity.billcountrycode != 'IM' && entity.billcountrycode != 'IL' && entity.billcountrycode != 'IT' && entity.billcountrycode != 'JE' && entity.billcountrycode != 'XK' && entity.billcountrycode != 'LV' && entity.billcountrycode != 'LT' && entity.billcountrycode != 'LU' && entity.billcountrycode != 'MT' && entity.billcountrycode != 'MQ' && entity.billcountrycode != 'YT' && entity.billcountrycode != 'MC' && entity.billcountrycode != 'ME' && entity.billcountrycode != 'NC' && entity.billcountrycode != 'NO' && entity.billcountrycode != 'HU' && entity.billcountrycode != 'PL' && entity.billcountrycode != 'PT' && entity.billcountrycode != 'RE' && entity.billcountrycode != 'RO' && entity.billcountrycode != 'BL' && entity.billcountrycode != 'MF' && entity.billcountrycode != 'PM' && entity.billcountrycode != 'SM' && entity.billcountrycode != 'SK' && entity.billcountrycode != 'SI' && entity.billcountrycode != 'ES' && entity.billcountrycode != 'SE' && entity.billcountrycode != 'CH' && entity.billcountrycode != 'NL' && entity.billcountrycode != 'VA' && entity.billcountrycode != 'WF')) ||(pymntCurrency == 'GBP' && (entity.billcountrycode != 'GG' && entity.billcountrycode != 'IM' && entity.billcountrycode != 'JE')) || (pymntCurrency == 'NZD' && (entity.billcountrycode != 'AU')) || (pymntCurrency == 'HKD' && entity.billcountrycode != 'CN') || (pymntCurrency == 'CNH' && entity.billcountrycode != 'HK') || (pymntCurrency == 'CNY' && entity.billcountrycode != 'HK') || (pymntCurrency == 'AUD' && entity.billcountrycode != 'NZ')>
<#if ebank.custrecord_2663_entity_swiftcode_bic?has_content>
:56A:${ebank.custrecord_2663_entity_swiftcode_bic}
<#elseif ebank.custrecord_2663_entity_routing_number?has_content>
:56D://${ebank.custrecord_2663_entity_routing_number}
</#if>
</#if>
<#if ebank.custrecord_2663_entity_swiftcode_bic?has_content>
:57A:${ebank.custrecord_2663_entity_swiftcode_bic}
<#elseif ebank.custrecord_2663_entity_routing_number?has_content>
:57D://FW${ebank.custrecord_2663_entity_routing_number}
</#if>
:59:/${getEntityAccountNumber(ebank,entity.billcountrycode)}
<#if entityName?has_content>
${splitAddr(removeInvalidCharacter(entityName))}
</#if>
<#if entityAddress?has_content || entity.city?has_content>
${splitAddr(removeInvalidCharacter(entityAddress + " " + entity.city))}
</#if>
<#if entity.billcountrycode?has_content>
${entity.billcountrycode}
</#if>
:70:${cbank.custrecord_2663_print_company_name}
<#if referenceNote?has_content>
<#if (referenceNote?length > 35)>
${removeInvalidCharacter(referenceNote?substring(0,35))}
<#else>
${removeInvalidCharacter(referenceNote)}
</#if>
</#if>
:71A:<#if pymntCurrency != 'USD'>${ebank.custrecord_2663_entity_charge_bearer_det}<#else>SHA</#if>
<#if ebank.custrecord_2663_customer_code?has_content>
:72:${getBankToBank(pymntCurrency)}${ebank.custrecord_2663_customer_code}
</#if>
:END:
</#list>
#REMOVE EOL#
#OUTPUT END#