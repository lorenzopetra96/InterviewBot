const sql = require('mssql');

const config = {
    user: 'lorenzopetra96',
    password: 'Napoletano96!',
    server: 'hrdb01.database.windows.net', // You can use 'localhost\\instance' to connect to named instance
    database: 'hrdb01',
    "options": {
        "encrypt": true,
        "enableArithAbort": true
        }
}

var connection = new sql.ConnectionPool(config);

connection.connect((err)=>{
    if(err) return console.log('Could not create DB Connection!');
    console.log('Successfully Connected to Database!');    
});



module.exports = connection;

