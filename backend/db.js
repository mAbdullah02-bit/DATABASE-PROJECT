const mysql = require('mysql2');

// Create a connection to the database
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',  // Ensure this matches your actual MySQL username
    password: 'Abbisql@123',  // Ensure this matches your MySQL password
    database: 'gamestore',
    port: 3006,  // Use port 3006
  });
  
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ', err);
  } else {
    console.log('Connected to the database');
  }
});

module.exports = db;
