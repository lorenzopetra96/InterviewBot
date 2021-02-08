const { Connection, Request } = require("tedious");
const { arrayify } = require("tslint/lib/utils");
const { isJSDocCallbackTag } = require("typescript");



const executeSQL = (sql, callback) => {
  let connection = new Connection({
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

  connection.connect((err) => {
    if (err)
      return callback(err, null);

    const request = new Request(sql, (err, rowCount, rows) => {
      connection.close();

      if (err)
        return callback(err, null);

      callback(null, {rowCount, rows});
    });

    connection.execSql(request);
  });
};


executeSQL('SELECT * FROM "User"', (err, data) => {
    if (err)
      console.error(err);

      
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
});
  