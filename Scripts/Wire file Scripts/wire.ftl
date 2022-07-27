
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
<#if str?length &gt; 35>
<#assign addr1 = str?substring(0,33)>
<#assign addr2 = str?substring(33,str?length)>
<#assign newAddr = addr1+'\r\n'+addr2>
<#return newAddr>
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
<#assign entityName = buildEntityName(entity,false)>
<#assign entityAddress = buildEntityAddress(entity)>
<#assign referenceNote = getReferenceNote(payment)>
<#assign pymntCurrency = getCurrencySymbol(payment.currency)?upper_case>
:20:${payment.tranid}
:32A:${pfa.custrecord_2663_process_date?string("yyyyMMdd")}${pfa.custrecord_2663_process_date?string("yyyyMMdd")}${pymntCurrency}<#if pymntCurrency == 'JPY'>${formatAmount(getAmount(payment),"noDec")}<#else>${formatAmount(getAmount(payment),"dec",",")}</#if>

:36:${payment.exchangerate?string("##.####")}

:50:/${getBankAccountNumber(cbank)}

<#if ebank.custrecord_2663_entity_bic?contains("FW")>

:57D://${ebank.custrecord_2663_entity_bic}

<#if ebank.custrecord_2663_entity_bank_name?has_content>
${ebank.custrecord_2663_entity_bank_name}
</#if>

<#if ebank.custrecord_2663_entity_state?has_content>
${ebank.custrecord_2663_entity_state}
</#if>

<#if ebank.custrecord_2663_entity_country_code?has_content>
${ebank.custrecord_2663_entity_country_code}
</#if>

<#else>

:57A:${ebank.custrecord_2663_entity_bic}

</#if>

:59:/${getEntityAccountNumber(ebank,entity.billcountrycode)}
<#if entityName?has_content>
${splitAddr(removeInvalidCharacter(entityName))}
</#if>
<#if entityAddress?has_content>
${splitAddr(removeInvalidCharacter(entityAddress))}
</#if>
<#if entity.city?has_content>
${removeInvalidCharacter(entity.city)}
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
:71A:<#if pymntCurrency != 'USD'>${ebank.custrecord_details_of_charges}<#else>SHA</#if>
<#if ebank.custrecord_2663_customer_code?has_content>
:72:${getBankToBank(pymntCurrency)}${ebank.custrecord_2663_customer_code}
</#if>
:END:
</#list>
#REMOVE EOL#
#OUTPUT END#