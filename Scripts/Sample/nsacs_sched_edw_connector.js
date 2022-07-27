/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
  @NModuleScope SameAccount
 */
  define(["N/record", "N/search", "N/runtime", "N/sftp", "N/keyControl", "N/task", "N/file"],


  function(record, search, runtime, sftp, keyControl, task, file) {
	  
	const GLOBAL_CSV_MAP = {
		  je: "custimport_edw_je_csv_map",
		  icje: "custimport_edw_icje_csv_map"
	  }

	  //SB 1 folder ID
	//   const PENDING_FOLDER = 1059;

	  //Prod  folder ID
	    const PENDING_FOLDER = 1619;


	  function constructDate() {
		  //construct current date string to look for file
		  var objCurrentDate = new Date();
		  let currentYear = `${objCurrentDate.getFullYear()}`;
		  let currentMonth = objCurrentDate.getMonth() + 1 > 9 ? `${objCurrentDate.getMonth()+1}` : `0${objCurrentDate.getMonth()+1}`;
		  let currentDate = objCurrentDate.getDate() > 9 ? `${objCurrentDate.getDate()}` : `0${objCurrentDate.getDate()}`;
		  log.debug("constructed date", `${currentYear}-${currentMonth}-${currentDate}`);
		  return `${currentYear}-${currentMonth}-${currentDate}`;
	  }

	  function execute(context) {
		  try {

			  //download all CSV files and save them to the pending folder
			  var strHostKey = "AAAAB3NzaC1yc2EAAAADAQABAAABAQCztIqodM9dOk7RWC/eBcLEL8RD9M+dCgyddFG6pEfDiBWYy3ubOStYSLjPc5Dg22rNpimSL1bRN5Bi4d1uIr2UBaoOccPmmyr/NZnrGdHeCTNl2675bLzn/xiEHLJ4mVHAWs6OzDGVUGBKvV+R/qN/NL35RNjJ7ow/vYrcxpySWn5bnd4duOjO2hC1FeauYCA/EUGOauuW7OXTxYvK6e94+uaTh3N0N1ecYuCmPi1Hpx3IY5P6J24ZfJdMl+frkS+5rkMus7Vi0ieGOTrh8ERUSlffiIWq3pK+b628o7pmqvTAoIcmlnlEH+Vrgz+6uEnJkI40z7Z0ijmCzm8q7Rq1";

			  var objConnection = sftp.createConnection({
				  username: 'netsuite',
				  keyId: 'custkeynsacs_brav_edw_sftp',
				  url: 'secured-files.braviantholdings.com',
				  port: 22,
				  hostKey: strHostKey
			  });

			  var dir = objConnection.list({
				  path: '/'
			  });
			  log.debug("Dir", dir);

			  var strDateFilename = constructDate();
			  var arrFileID = [];
			  for (var i = 0; i < dir.length; i++) {
				  let dirName = dir[i].name;

				  if (dirName.includes(strDateFilename)) {
					  var downloadedFile = objConnection.download({
						  directory: '/',
						  filename: dirName
					  });

					  downloadedFile.folder = PENDING_FOLDER;
					  var fileId = downloadedFile.save();
					  log.audit(`Saved File`, `Filename:${dirName}, NS File ID: ${fileId}`);
					  arrFileID.push(fileId);

					  //getting access denied errors
					  if (fileId) {
						  try {
							  objConnection.removeFile({
								  path: dirName
							  });
							  log.audit(`Removed from SFTP Server`, `Filename:${dirName}, NS File ID: ${fileId}`);
						  } catch (error) {
							  log.error(`Error deleting file in SFTP Server`, `Error Details: ${error}`);
						  }
					  }
				  }
			  }

			  //sample import ID's
			  // arrFileID = [62970, 63566]

			  for (var j = 0; j < arrFileID.length; j++) {
				  var fileID = arrFileID[j];
				  var objFile = file.load({
					  id: fileID
				  });

				  var strFilename = objFile.name;
				  var strCSVMap = null;
				  var recordType = null;

				  if (strFilename.includes("SDJE")) {
					  //SDJE for strFilename.includes("SDJE")
					  strCSVMap = GLOBAL_CSV_MAP.je
					  recordType = "Standard JE";

					  var objCSVImport = task.create({
						  taskType: task.TaskType.CSV_IMPORT,
						  importFile: objFile.getContents(),
						  mappingId: strCSVMap,
						  name: `${strFilename} - EDW Automated Import - ${recordType}`
					  });

					  var csvImportID = objCSVImport.submit();

					  log.audit("csvImportID", csvImportID);
					  // }else if(strFilename.includes("ICJE")){
					  // 	strCSVMap = GLOBAL_CSV_MAP.icje
					  // 	recordType = "Adv. Intercompany JE";

					  // 	var objCSVImport = task.create({
					  // 		taskType: task.TaskType.CSV_IMPORT,
					  // 		importFile: objFile.getContents(),
					  // 		mappingId: strCSVMap,
					  // 		name: `${strFilename} - EDW Automated Import - ${recordType}`
					  // 	});

					  // 	var csvImportID = objCSVImport.submit();

					  // 	log.audit("csvImportID", csvImportID);
				  } else {
					  log.audit("Record Type not found", strFilename)
				  } //for other records


			  }
		  } catch (error) {
			  log.error("Error in Script", error)
		  }
	  }

	  return {
		  execute: execute
	  }
  });