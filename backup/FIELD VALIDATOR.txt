<fieldValidatorList>
<fieldValidator>
<fieldName>custrecord_2663_print_company_name</fieldName>
<validatorList>
<validator type="validChars">
<param name="validChars">0-9A-Za-z&apos;:\,\- \(\+\.\)/</param>
</validator>
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_acct_num</fieldName>
<validatorList>
<validator type='len'>
<param name="maxLength">34</param>
</validator>
<validator type="validChars">
<param name="validChars">0-9A-Za-z&apos;:\,\- \(\+\.\)/</param>
</validator>
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_iban</fieldName>
<validatorList>
<validator type='len'>
<param name="maxLength">34</param>
</validator>
<validator type='iban' />
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_entity_bic</fieldName>
<validatorList>
<validator type="len">
<param name="validLength">8|11</param>
</validator>
<validator type='bic' />
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_entity_iban</fieldName>
<validatorList>
<validator type='len'>
<param name="maxLength">34</param>
</validator>
<validator type='iban' />
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_entity_acct_no</fieldName>
<validatorList>
<validator type='len'>
<param name="maxLength">34</param>
</validator>
<validator type="validChars">
<param name="validChars">0-9A-Za-z&apos;:\,\- \(\+\.\)/</param>
</validator>
</validatorList>
</fieldValidator>
<fieldValidator>
<fieldName>custrecord_2663_entity_charge_bearer_det</fieldName>
<validatorList>
<validator type="validContent">
<param name="validContent">BEN|OUR|SHA</param>
</validator>
</validatorList>
</fieldValidator>
</fieldValidatorList>