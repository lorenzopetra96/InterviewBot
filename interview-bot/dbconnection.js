const { Connection, Request } = require("tedious");
const { arrayify } = require("tslint/lib/utils");
const { isJSDocCallbackTag } = require("typescript");

var connection1;

class DatabaseConnection{
    
    constructor(){

        var connection = new Connection({
            "authentication": {
              "options": {
                "userName": "lorenzopetra96",
                "password": "Napoletano96!"
              },
              "type": "default"
            },
            "server": "hrdb01.database.windows.net",
            "options": {
              "validateBulkLoadParameters": false,
              "rowCollectionOnRequestCompletion": true,
              "database": "hrdb01",
              "encrypt": true
            }
          });
        connection1 = connection;
    }

    executeQuery(query){

      const executeSQL = (sql, callback) => {
        connection1.connect((err) => {
          if (err)
            return callback(err, null);
      
          const request = new Request(sql, (err, rowCount, rows) => {
            
            request.on('requestCompleted', function () {
              connection1.close();
            });
            
            connection1.
            
            console.log("Ho chiuso la connessione");
            if (err)
              return callback(err, null);
      
            callback(null, {rowCount, rows});
          });
      
          connection1.execSql(request);
        });
    }

    executeSQL(query, (err, data) => {
      if (err)
        console.error(err);
  
        if(query.includes("SELECT")){
        var Array = [];
  
        data.rows.forEach(row => {
          row.forEach(elem => {
            Array.push(JSON.stringify(elem));
          })
        })
  
        Array.forEach(elem => {
          
          var el = JSON.parse(elem);
          console.log("%s\t%s", el.metadata.colName ,el.value, );
        });
      }
  });
    }
}

module.exports.DatabaseConnection = DatabaseConnection;