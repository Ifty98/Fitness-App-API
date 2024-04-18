let express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

require('./http_status.js');

let app = express();
let mysql = require('mysql2');

let connectionPool = mysql.createPool({
    connectionLimit: 50,
    host: "database-1.ct200akq0p0y.eu-west-2.rds.amazonaws.com",
    user: "admin",
    password: "Iftynumber2",
    database: "fitness_app",
    debug: false
})

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

//app.listen(8081);

async function startServer() {
    try {
        app.get('/checkUser', (req, res) => {
            const { username, password } = req.query;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required.' });
            }

            const trimmedUsername = username.trim();
            const trimmedPassword = password.trim();

            connectionPool.query(
                'SELECT * FROM user WHERE username = ? AND password = ?',
                [trimmedUsername, trimmedPassword],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.length > 0) {
                        res.status(200).json({ message: 'User found in the database.' });
                    } else {
                        res.status(404).json({ message: 'User not found in the database.' });
                    }
                }
            );
        });

        app.get('/checkUsername', (req, res) => {
            const { username } = req.query;

            if (!username) {
                return res.status(400).json({ error: 'Username is required.' });
            }

            connectionPool.query(
                'SELECT * FROM user WHERE username = ?',
                [username],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.length > 0) {
                        res.status(200).json({ exists: true, message: 'Username already exists.' });
                    } else {
                        res.status(200).json({ exists: false, message: 'Username does not exist.' });
                    }
                }
            );
        });

        app.post('/createUser', (req, res) => {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required.' });
            }

            const trimmedUsername = username.trim();
            const trimmedPassword = password.trim();

            connectionPool.getConnection((err, connection) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }

                connection.beginTransaction((err) => {
                    if (err) {
                        connection.release();
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    connection.query(
                        'INSERT INTO user (username, password) VALUES (?, ?)',
                        [trimmedUsername, trimmedPassword],
                        (err, userResults) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error(err);
                                    res.status(500).json({ error: 'Internal Server Error' });
                                });
                            }

                            const userId = userResults.insertId;

                            connection.query(
                                'INSERT INTO personal_data (user_id) VALUES (?)',
                                [userId],
                                (err, personalDataResults) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            console.error(err);
                                            res.status(500).json({ error: 'Internal Server Error' });
                                        });
                                    }

                                    connection.query(
                                        'INSERT INTO progress (user_id) VALUES (?)',
                                        [userId],
                                        (err, progressResults) => {
                                            if (err) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    console.error(err);
                                                    res.status(500).json({ error: 'Internal Server Error' });
                                                });
                                            }

                                            connection.commit((err) => {
                                                if (err) {
                                                    return connection.rollback(() => {
                                                        connection.release();
                                                        console.error(err);
                                                        res.status(500).json({ error: 'Internal Server Error' });
                                                    });
                                                }
                                                connection.release();
                                                res.status(201).json({ message: 'User and related records created successfully.' });
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            });
        });

        app.put('/updatePersonalData/:userId', (req, res) => {
            const userId = req.params.userId;
            const { gender, age, weight } = req.body;
        
            if (!userId || (!gender && !age && !weight)) {
                return res.status(400).json({ error: 'User ID and at least one field to update are required.' });
            }
        
            const trimmedUserId = userId.trim();
        
            connectionPool.query(
                'UPDATE personal_data SET gender = ?, age = ?, weight = ? WHERE user_id = ?',
                [gender, age, weight, trimmedUserId],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
        
                    if (results.affectedRows === 0) {
                        return res.status(404).json({ error: 'User ID not found in personal_data.' });
                    }
        
                    res.status(200).json({ message: 'Personal data updated successfully.' });
                }
            );
        });        

        app.put('/updateProgress/:userId', (req, res) => {
            const userId = req.params.userId;
            const { physical_progress, academic_progress } = req.body;

            if (!userId || (!physical_progress && !academic_progress)) {
                return res.status(400).json({ error: 'User ID and at least one field to update are required.' });
            }

            const trimmedUserId = userId.trim();

            connectionPool.query(
                'UPDATE progress SET physical_progress = ?, academic_progress = ? WHERE user_id = ?',
                [physical_progress, academic_progress, trimmedUserId],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.affectedRows === 0) {
                        return res.status(404).json({ error: 'User ID not found in progress.' });
                    }

                    res.status(200).json({ message: 'Progress data updated successfully.' });
                }
            );
        });

        app.post('/createProject', (req, res) => {
            const { user_id, name, description, deadline, status } = req.body;

            if (!user_id || !name || !description || !deadline || !status) {
                return res.status(400).json({ error: 'User ID, name, description, deadline, and status are required.' });
            }

            const trimmedName = name.trim();
            const trimmedDescription = description.trim();
            const trimmedStatus = status.trim();

            connectionPool.query(
                'INSERT INTO project (user_id, name, description, deadline, status) VALUES (?, ?, ?, ?, ?)',
                [user_id, trimmedName, trimmedDescription, deadline, trimmedStatus],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    res.status(201).json({ message: 'Project created successfully.' });
                }
            );
        });

        app.post('/createDisability', (req, res) => {
            const { user_id, name, description } = req.body;

            if (!user_id || !name || !description) {
                return res.status(400).json({ error: 'User ID, name, and description are required.' });
            }

            const trimmedName = name.trim();
            const trimmedDescription = description.trim();

            connectionPool.query(
                'INSERT INTO disabilities (user_id, name, description) VALUES (?, ?, ?)',
                [user_id, trimmedName, trimmedDescription],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    res.status(201).json({ message: 'Disability created successfully.' });
                }
            );
        });

        app.post('/createActivity', (req, res) => {
            const { user_id, name, total_time, calories_burned } = req.body;

            if (!user_id || !name || !total_time || !calories_burned) {
                return res.status(400).json({ error: 'User ID, name, total time, and calories burned are required.' });
            }

            const trimmedName = name.trim();
            const trimmedTotalTime = total_time.trim();

            connectionPool.query(
                'INSERT INTO activity (user_id, name, total_time, calories_burned) VALUES (?, ?, ?, ?)',
                [user_id, trimmedName, trimmedTotalTime, calories_burned],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    res.status(201).json({ message: 'Activity created successfully.' });
                }
            );
        });

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Error starting server:', error);
    }
}

startServer();