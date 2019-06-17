const mysql = require('mysql')

const pool = mysql.createPool({
    host: 'localhost',
    user: 'zzh',
    password: 'zzhllc,./',
    database: 'course-platform',
    port: 3306
})

const sqlQuery = (sql, values) => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                reject(err)
            } else {
                if (values) {
                    connection.query(sql, values, (err, rows) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(rows)
                        }
                        connection.release()
                    })
                } else {
                    connection.query(sql, (err, rows) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(rows)
                        }
                        connection.release()
                    })
                }
            }
        })
    })
}

module.exports = {
    sqlQuery
}