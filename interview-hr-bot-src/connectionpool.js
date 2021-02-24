const sql = require('mssql');
const config = require('./dbconfig');

var connection = new sql.ConnectionPool(config);

connection.connect((err)=>{
    if(err) return console.log('Could not create DB Connection!');
    console.log('Successfully Connected to Database!');  
});


module.exports = connection;

