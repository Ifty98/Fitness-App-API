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

        app.get('/user/:id', (req, res) => {
            const userId = req.params.id;

            // Query to get username and password of user by ID
            const query = 'SELECT username, password FROM user WHERE id = ?';

            connectionPool.query(query, [userId], (error, results) => {
                if (error) {
                    console.error('Error retrieving user:', error);
                    res.status(500).send('Error retrieving user');
                    return;
                }

                if (results.length === 0) {
                    res.status(404).send('User not found');
                    return;
                }

                const user = results[0];
                res.json(user);
            });
        });


        app.get('/getID', (req, res) => {
            const { username, password } = req.query;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required.' });
            }

            const trimmedUsername = username.trim();
            const trimmedPassword = password.trim();

            connectionPool.query(
                'SELECT id FROM user WHERE username = ? AND password = ?',
                [trimmedUsername, trimmedPassword],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.length > 0) {
                        const userId = results[0].id;
                        res.status(200).json({ userId: userId });
                    } else {
                        res.status(404).json({ message: 'User not found in the database.' });
                    }
                }
            );
        });

        app.get('/personal-data/:userId', (req, res) => {
            const userId = req.params.userId;

            connectionPool.query(
                'SELECT * FROM personal_data WHERE user_id = ?',
                [userId],
                (err, results) => {
                    if (err) {
                        console.error('Error retrieving personal data:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('Personal data retrieved successfully:', results);
                    res.status(200).json(results);
                }
            );
        });

        app.put('/user/:id/password', (req, res) => {
            const userId = req.params.id;
            const newPassword = req.query.newPassword;

            if (!newPassword) {
                res.status(400).send('New password is required');
                return;
            }

            const query = 'UPDATE user SET password = ? WHERE id = ?';

            connectionPool.query(query, [newPassword, userId], (error, results) => {
                if (error) {
                    console.error('Error updating password:', error);
                    res.status(500).send('Error updating password');
                    return;
                }

                res.status(200).json({ message: 'Changed password succesfully' });
            });
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

        app.post('/step-counter', (req, res) => {
            const { user_id, date, steps } = req.query;

            if (!user_id || !date || !steps) {
                return res.status(400).json({ error: 'user_id, date, and steps are required' });
            }

            const sql = 'INSERT INTO step_counter (user_id, date, steps) VALUES (?, ?, ?)';
            const values = [user_id, date, steps];

            connectionPool.query(sql, values, (err, result) => {
                if (err) {
                    console.error('Error inserting data into step_counter:', err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
                console.log('New entry added to step_counter:', result);
                res.status(201).json({ message: 'New entry added to step_counter' });
            });
        });


        app.get('/step-counter/:userId', (req, res) => {
            const userId = req.params.userId;

            connectionPool.query(
                'SELECT * FROM step_counter WHERE user_id = ?',
                [userId],
                (err, results) => {
                    if (err) {
                        console.error('Error retrieving step-counter entries:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('Step-counter entries retrieved successfully:', results);
                    res.status(200).json(results);
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

        app.put('/updateProject/:projectId', (req, res) => {
            const projectId = req.params.projectId;
            const status = req.query.status; // Retrieve status from query parameters

            if (!projectId || !status) {
                return res.status(400).json({ error: 'Project ID and status are required.' });
            }

            const trimmedStatus = status.trim();

            connectionPool.query(
                'UPDATE project SET status = ? WHERE id = ?',
                [trimmedStatus, projectId],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.affectedRows === 0) {
                        return res.status(404).json({ error: 'Project ID not found.' });
                    }

                    res.status(200).json({ message: 'Project status updated successfully.' });
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


        app.get('/projects/:user_id', (req, res) => {
            const user_id = req.params.user_id;

            // Query to get projects with specified user_id
            const query = 'SELECT * FROM project WHERE user_id = ?';

            // Execute the query
            connectionPool.query(query, [user_id], (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }

                // Send the results as JSON response
                res.status(200).json(results);
            });
        });

        app.post('/createSubtask', (req, res) => {
            const { project_id, name, status } = req.query;

            if (!project_id || !name || !status) {
                return res.status(400).json({ error: 'project_id, name, and status are required' });
            }

            const trimmedName = name.trim();
            const trimmedStatus = status.trim();

            connectionPool.query(
                'INSERT INTO subtask (project_id, name, status) VALUES (?, ?, ?)',
                [project_id, trimmedName, trimmedStatus],
                (err, results) => {
                    if (err) {
                        console.error('Error inserting data into subtask:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('New entry added to subtask:', results);
                    res.status(201).json({ message: 'New entry added to subtask' });
                }
            );
        });


        app.get('/subtasks/:projectId', (req, res) => {
            const projectId = req.params.projectId;

            // Query the database to retrieve subtasks with the specified projectId
            connectionPool.query(
                'SELECT * FROM subtask WHERE project_id = ?',
                [projectId],
                (err, results) => {
                    if (err) {
                        console.error('Error retrieving subtasks:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('Subtasks retrieved successfully:', results);
                    res.status(200).json(results);
                }
            );
        });


        app.put('/updateSubtask/:subtaskId', (req, res) => {
            const subtaskId = req.params.subtaskId;
            const { status } = req.query; // Retrieve status from query parameters

            if (!subtaskId || !status) {
                return res.status(400).json({ error: 'Subtask ID and status are required.' });
            }

            const trimmedStatus = status.trim();

            connectionPool.query(
                'UPDATE subtask SET status = ? WHERE id = ?',
                [trimmedStatus, subtaskId],
                (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    if (results.affectedRows === 0) {
                        return res.status(404).json({ error: 'Subtask ID not found.' });
                    }

                    res.status(200).json({ message: 'Subtask status updated successfully.' });
                }
            );
        });

        app.delete('/subtasks/:subtaskId', (req, res) => {
            const subtaskId = req.params.subtaskId;

            // Your logic to delete the subtask from the database
            connectionPool.query(
                'DELETE FROM subtask WHERE id = ?',
                [subtaskId],
                (err, results) => {
                    if (err) {
                        console.error('Error deleting subtask:', err);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('Subtask deleted successfully:', results);
                    res.status(200).json({ message: 'Subtask deleted successfully' });
                }
            );
        });

        // Express route to delete a project by ID and its associated subtasks
        app.delete('/projects/:projectId', (req, res) => {
            const projectId = req.params.projectId;

            // Delete subtasks associated with the project
            connectionPool.query(
                'DELETE FROM subtask WHERE project_id = ?',
                [projectId],
                (subtaskErr, subtaskResults) => {
                    if (subtaskErr) {
                        console.error('Error deleting subtasks:', subtaskErr);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log('Subtasks deleted successfully:', subtaskResults);

                    // Now delete the project
                    connectionPool.query(
                        'DELETE FROM project WHERE id = ?',
                        [projectId],
                        (projectErr, projectResults) => {
                            if (projectErr) {
                                console.error('Error deleting project:', projectErr);
                                return res.status(500).json({ error: 'Internal Server Error' });
                            }
                            console.log('Project deleted successfully:', projectResults);
                            res.status(200).json({ message: 'Project and associated subtasks deleted successfully' });
                        }
                    );
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