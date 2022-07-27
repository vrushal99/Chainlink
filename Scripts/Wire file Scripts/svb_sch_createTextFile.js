/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */

 define(['N/task', 'N/record','N/search','N/file'], function (task, record, search, file) {

    function execute(context){

        try{

        var invoiceSearchObj = search.create({
        type: "invoice",
        filters:
        [
            ["type","anyof","CustInvc"], 
            "AND", 
            ["mainline","is","F"], 
           
        ],
        columns:
        [
            search.createColumn({name: "trandate", label: "Date"}),
            search.createColumn({name: "tranid", label: "Document Number"}),
            search.createColumn({name: "entity", label: "Name"}),
            search.createColumn({name: "account", label: "Account"}),
            search.createColumn({name: "memo", label: "Memo"}),
            search.createColumn({name: "amount", label: "Amount"})
        ]
        });

         var searchResultCount = invoiceSearchObj.run().getRange(0, 1000);

         log.debug({
             title: 'searchResultCount',
             details: searchResultCount
             });

             var arrResult = [];
             

             for(var i=0; i<searchResultCount.length; i++){


                var trandate = searchResultCount[i].getValue({name: "trandate"});
                var tranid = searchResultCount[i].getValue({name: "tranid"});
                var entity = searchResultCount[i].getValue({name: "entity"});
                var account = searchResultCount[i].getValue({name: "account"});
                var memo = searchResultCount[i].getValue({name: "memo"});
                var amount = searchResultCount[i].getValue({name: "amount"});

             

                arrResult.push("\r\n" + trandate,tranid,entity,account,memo,amount + "/" );

             }

            


             log.debug({
                    title: 'arrResult',
                        details: arrResult
                        });
      
         var createFile = file.create(
            {   
                name: 'Invoice_' + searchResultCount[0].getValue({name: "tranid"}) + '.txt',
                fileType: file.Type.PLAINTEXT,
                contents: String(arrResult),
                encoding: file.Encoding.UTF8,
                folder: 419,
                            
                           
            }
        );
        
        var fileId = createFile.save();

        log.debug('fileId', fileId);

        }
        catch(e){

            log.debug({
                title: 'error in function',
                details: e.toString()
                });

                log.debug();

        }

    }
    return {
        execute: execute
    }
})
