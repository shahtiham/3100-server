import mysql from 'mysql';
import helmet from 'helmet';
import express from 'express';
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import cors from 'cors'
import e from 'express';

const app = express();

/*
CREATE DATABASE project3100;

CREATE TABLE questions (
    q_id INT AUTO_INCREMENT PRIMARY KEY,
    u_id INT,
    title VARCHAR(1024)
    question VARCHAR(15000) NOT NULL,
    tag VARCHAR(32) NOT NULL,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
    a_id INT AUTO_INCREMENT PRIMARY KEY,
    answer VARCHAR(15000) NOT NULL,
    q_id INT,
    u_id INT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (q_id) REFERENCES questions(q_id)
);

CREATE TABLE credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL,
    email VARCHAR(64) NOT NULL,
    pass VARCHAR(128) NOT NULL,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE q_vote (
    q_id INT,
    vote INT,
    u_id INT,
    primary key(q_id, u_id)
);

CREATE TABLE a_vote (
    a_id INT,
    vote INT,
    u_id INT,
    primary key(a_id, u_id)
);

*/

/* app.use(
    cors({
        origin: '*',
        methods: ["GET", "POST"],
        credentials: false,
    })
) */
app.use(cors());

app.use(helmet());
app.use(express.json());
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
    host: process.env.HOST,
    //port: process.env.port,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

const auth = (req, res, next) => {
    //console.log(req)
    const token =
        req.body.token || req.query.token || req.headers["authorization"];
    //console.log(token)
    if (!token) {
        return res.status(403).send("A token is required for authentication");
    }
    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;
        //console.log(req.user)
    } catch (err) {
        return res.status(401).send("Invalid Token");
    }

    return next();
};

// specific question...
app.get('/questions/qid/:qid', (req, res) => {
    //console.log('1')
    //SELECT * FROM questions
    db.query(`SELECT questions.q_id, questions.u_id, questions.title, questions.question, questions.tag, questions.created, UPVOTE.votes FROM questions LEFT JOIN (SELECT q_vote.q_id, SUM(q_vote.vote) as votes FROM q_vote GROUP BY q_vote.q_id) AS UPVOTE ON questions.q_id = UPVOTE.q_id WHERE questions.u_id = ${req.params.qid}`, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            res.json(rlt);
        }
    });

});

// specific question with username(un-necessary..)
app.get('/questions/uid/:qid', (req, res) => {
    db.query(`SELECT credentials.username FROM questions LEFT JOIN credentials ON questions.u_id = credentials.id WHERE questions.q_id = ${req.params.qid}`, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            res.json(rlt);
        }
    });

});

//query to get questions of current user:
//SELECT questions.q_id, questions.question, questions.tag, questions.created, UPVOTE.votes FROM questions LEFT JOIN (SELECT q_vote.q_id, SUM(q_vote.vote) as votes FROM q_vote GROUP BY q_vote.q_id) AS UPVOTE ON questions.q_id = UPVOTE.q_id WHERE questions.u_id = 14
app.get('/questions/:uid/:o', (req, res) => {
    //console.log('2')
    let q = `SELECT T.q_id, T.title, T.username, T.created, S.votes FROM (SELECT questions.q_id, questions.title, credentials.username, questions.created FROM questions RIGHT JOIN credentials ON questions.u_id = credentials.id WHERE credentials.id = ${req.params.uid}) AS T LEFT JOIN (SELECT SUM(q_vote.vote) AS votes, q_vote.q_id FROM q_vote GROUP BY q_vote.q_id) AS S ON T.q_id = S.q_id ORDER BY ${(req.params.o === 'date')?'T.created':'S.votes'} DESC`
    db.query(q, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            res.json(rlt);
        }
    });
});

app.get('/questions/ans/:uid/:o', (req, res) => {
    let q = `SELECT S.q_id, S.title, S.a_id, S.username, S.date, R.votes FROM (SELECT T.q_id, T.title, T.a_id, credentials.username, T.date FROM (SELECT questions.q_id, questions.title, answers.a_id, answers.u_id, answers.date FROM questions JOIN answers ON questions.q_id = answers.q_id WHERE answers.u_id = ${req.params.uid}) AS T RIGHT JOIN credentials ON T.u_id = credentials.id WHERE credentials.id = ${req.params.uid}) AS S LEFT JOIN (SELECT SUM(a_vote.vote) AS votes, a_vote.a_id FROM a_vote GROUP BY a_vote.a_id) AS R ON R.a_id = S.a_id ORDER BY ${(req.params.o === 'date')?'S.date':'R.votes'} DESC`
    db.query(q, (err, rlt) => {
        if(err){
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            res.json(rlt);
        }
    })
})

// with/without tag & with? username
app.get('/questions/tagged/:tag/:qid/:o', (req, res) => {
    //console.log('3')
    //`SELECT LT.q_id, LT.u_id, credentials.username, LT.title, LT.question, LT.tag, LT.created, LT.votes FROM (SELECT questions.q_id, questions.u_id, questions.title, questions.question, questions.tag, questions.created, UPVOTE.votes FROM questions LEFT JOIN (SELECT q_vote.q_id, SUM(q_vote.vote) as votes FROM q_vote GROUP BY q_vote.q_id) AS UPVOTE ON questions.q_id = UPVOTE.q_id) AS LT LEFT JOIN credentials ON LT.u_id = credentials.id WHERE LT.tag LIKE 'vanilla'`

    let q = `SELECT questions.q_id, questions.u_id, questions.title, questions.question, questions.tag, questions.created, UPVOTE.votes FROM questions LEFT JOIN (SELECT q_vote.q_id, SUM(q_vote.vote) as votes FROM q_vote GROUP BY q_vote.q_id) AS UPVOTE ON questions.q_id = UPVOTE.q_id`
    q = `SELECT LT.q_id, LT.u_id, credentials.username, LT.title, LT.question, LT.tag, LT.created, LT.votes FROM (SELECT questions.q_id, questions.u_id, questions.title, questions.question, questions.tag, questions.created, UPVOTE.votes FROM questions LEFT JOIN (SELECT q_vote.q_id, SUM(q_vote.vote) as votes FROM q_vote GROUP BY q_vote.q_id) AS UPVOTE ON questions.q_id = UPVOTE.q_id) AS LT LEFT JOIN credentials ON LT.u_id = credentials.id`
    if(req.params.tag !== 'all'){
        q = q + ` WHERE LT.tag LIKE '${req.params.tag}'`
    } else {
        if(req.params.qid !== '-1'){
            q = q + ` WHERE LT.q_id = ${req.params.qid}`
        }
    }
    q = q + ` ORDER BY ${(req.params.o === 'date')?'LT.created':'LT.votes'} DESC`
    // with username
    
    db.query(q, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            //console.log(rlt)
            res.json(rlt);
        }
    });

});

app.post('/questions', auth, (req, res) => {
    //console.log('4')
    db.query(`INSERT INTO questions (u_id, title, question, tag) VALUES (${req.user.user_id}, "${req.body.title}", "${req.body.question}", '${req.body.tag}')`, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            //hello
            res.send('Error communicating with DB server');
        } else {
            //console.log(rlt)
            res.json(rlt);
        }
    });
});

// EDIT QUESTION

app.post('/questions/edit', auth, (req, res) => {
    //console.log(req.user.user_id, req.body.u_id)
    if(req.user.user_id !== req.body.u_id){
        res.send("You can not edit other's question")
    } else {
        db.query(`UPDATE questions SET title = "${req.body.title}", question = "${req.body.question}", tag = "${req.body.tag}" WHERE q_id = ${req.body.q_id}`, (err, rlt) => {
            if(err) {
                console.log(err.stack);
                res.send('Error communicating with DB server')
            } else {
                //console.log(rlt);
                res.json(rlt)
            }
        });
    }
});

app.get('/answers/:q_id', (req, res) => {
    //console.log("hello", req.user)
    //`SELECT * FROM answers, (SELECT a_id, COUNT(a_id) AS upvote FROM a_vote) AS UPVOTE WHERE q_id = ${req.params.q_id} AND UPVOTE.a_id = answers.a_id`
    //`SELECT * FROM answers, (SELECT a_id, SUM(vote) AS upvote FROM a_vote GROUP BY a_id) AS UPVOTE WHERE q_id = ${req.params.q_id} AND UPVOTE.a_id = answers.a_id`
    //`SELECT * FROM answers LEFT JOIN (SELECT a_vote.a_id, SUM(a_vote.vote), a_vote.u_id FROM a_vote GROUP BY a_id) AS UPVOTE ON answers.a_id = UPVOTE.a_id WHERE answers.q_id = ${req.params.q_id}`
    
    // query to get with username(person who posted the answer) / correct one :
    //SELECT FT.a_id,FT.answer,FT.q_id,FT.u_id,credentials.username,FT.votes FROM (SELECT answers.a_id, answers.answer, answers.q_id, answers.u_id, answers.date, UPVOTE.votes FROM answers LEFT JOIN (SELECT a_vote.a_id, SUM(a_vote.vote) as votes FROM a_vote GROUP BY a_id) AS UPVOTE ON answers.a_id = UPVOTE.a_id WHERE answers.q_id = 1) AS FT LEFT JOIN credentials ON FT.u_id = credentials.id
    
    //SELECT LT.a_id,LT.answer,LT.q_id,LT.u_id,credentials.username,LT.date,LT.votes FROM (SELECT answers.a_id, answers.answer, answers.q_id, answers.u_id, answers.date, UPVOTE.votes FROM answers LEFT JOIN (SELECT a_vote.a_id, SUM(a_vote.vote) as votes FROM a_vote GROUP BY a_id) AS UPVOTE ON answers.a_id = UPVOTE.a_id) AS LT LEFT JOIN credentials ON LT.u_id = credentials.id WHERE LT.q_id = 1

    // correct one :
    // SELECT answers.a_id, answers.answer, answers.q_id, answers.u_id, answers.date, UPVOTE.votes FROM answers LEFT JOIN (SELECT a_vote.a_id, SUM(a_vote.vote) as votes FROM a_vote GROUP BY a_id) AS UPVOTE ON answers.a_id = UPVOTE.a_id WHERE answers.q_id = 1
    const q = `SELECT LT.a_id,LT.answer,LT.q_id,LT.u_id,credentials.username,LT.date,LT.votes FROM (SELECT answers.a_id, answers.answer, answers.q_id, answers.u_id, answers.date, UPVOTE.votes FROM answers LEFT JOIN (SELECT a_vote.a_id, SUM(a_vote.vote) as votes FROM a_vote GROUP BY a_id) AS UPVOTE ON answers.a_id = UPVOTE.a_id) AS LT LEFT JOIN credentials ON LT.u_id = credentials.id WHERE LT.q_id = ${req.params.q_id} ORDER BY LT.votes DESC`
    db.query(q , (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            res.json(rlt);
        }
    });

});

app.post('/answers', auth, (req, res) => {

    db.query(`INSERT INTO answers (answer, q_id, u_id) VALUES ("${req.body.answer}", ${req.body.q_id}, ${req.user.user_id})`, (err, rlt) => {
        if(err) {
            console.log(err.stack);
            res.send('Error communicating with DB server');
        } else {
            console.log(rlt)
            res.json(rlt);
        }
    });
});


// EDIT ANSWER

app.post('/answers/edit', auth, (req, res) => {
    //console.log(req.user.user_id, req.body)
    if(req.user.user_id !== req.body.u_id){
        res.send("You can not edit other's answer")
    } else {
        db.query(`UPDATE answers SET answer = "${req.body.answer}" WHERE a_id = ${req.body.a_id}`, (err, rlt) => {
            if(err) {
                console.log(err.stack);
                res.send('Error communicating with DB server')
            } else {
                //console.log(rlt);
                res.json(rlt)
            }
        });
    }
});


function getq(words){
    return new Promise((resolve, reject) => {
        let s_rlt = []
        for(let i=0; i<words.length; i++) {
            db.query(`SELECT * FROM questions WHERE question LIKE '%${words[i]}%'`, (err, rlt) => {
                if(err) {
                    console.log(err.stack);
                    res.send('Error communicating with DB server');
                } else {
                    s_rlt.push(rlt);
                    console.log(s_rlt.length);         
                }
            })
        }
        resolve(s_rlt)
    })
}

app.get('/search/:search', async (req, res) => {
    let s_rlt = [];
    let words = req.params.search.split(' ');

    try{
        const wait = await getq(words)
        console.log(wait.length, 'hi');
        res.json(wait);
    } catch{
        console.log('error')
    }
});

app.get('/vote/:ud/:qa/:id', auth, (req, res) => {
    let aorq = (req.params.qa === 'q')?'questions':'answers'
    db.query(`SELECT u_id FROM ${aorq} WHERE ${req.params.qa}_id = ${req.params.id}`, (err1, rlt1) => {
        if(err1) {
            console.log(err1.stack);
            res.send('Error communicating with DB server');
        } else {
            if(rlt1[0].u_id === req.user.user_id){
                res.send("not allowed to vote on you'r "+aorq)
            } else {
                db.query(`INSERT INTO ${req.params.qa}_vote (${req.params.qa}_id, vote, u_id) VALUES (${req.params.id}, ${req.params.ud === 'u' ? 1 : -1}, ${req.user.user_id})`, (err, rlt) => {
                    console.log(rlt,err)
                    if(err) {
                        if(err.code === 'ER_DUP_ENTRY') {
                            res.send('Already Voted');
                        } else {
                            console.log(err.stack);
                            res.send('Error communicating with DB server');
                        }
                    } else {
                        // query to get updated vote count (vote : GET REQUEST)
                        const q = `SELECT ${req.params.qa}_id, SUM(vote) as vote FROM ${req.params.qa}_vote WHERE ${req.params.qa}_id = ${req.params.id} GROUP BY ${req.params.qa}_id`
                        db.query(q , (errUp, rltUp) => {
                            if(errUp) {
                                //console.log(errUp.stack);
                                res.send('Error communicating with DB server. Failed to get updated vote count');
                            } else {
                                res.json(rltUp);
                                //console.log('updated res: ', rltUp)
                            }
                        });

                        // vote : POST REQUEST
                        //res.json(rlt);
                    }
                });
            }
        }
    });
    
});

app.get('/isloggedin', auth, (req, res) => {
    //console.log(req.user)
    const user = {user_id:req.user.user_id,email:req.user.email,isloggedin:'loggedin'}
    //res.send('loggedin');
    res.json(user)
})

//register

app.post("/register", (req, res) => {

    const { username, email, pass } = req.body;

    if (!(email && pass && username)) {
        res.status(400).send("All input is required");
    }

    db.query(`SELECT * FROM credentials WHERE email LIKE '${req.body.email}'`, (err, rlt) => {
        if (rlt.length) {
            //console.log(rlt)
            return res.send("User Already Exist. Please Login");
        } else {
            bcrypt.hash(pass, 10, function (err, hash) {
                db.query(`INSERT INTO credentials (username, email, pass) VALUES ('${username}', '${email}', '${hash}')`, (err, user) => {
                    if (user) {
                        const token = jwt.sign(
                            { user_id: user.insertId, email },
                            process.env.SECRET,
                            {
                                expiresIn: "4h",
                            }
                        );
                        user.username = username;
                        user.email = email;
                        user.token = token;
                        res.json(user);
                    }
                });
            });
        }
    });
});

// login


app.post("/login", (req, res) => {

    const { email, pass } = req.body;

    if (!(email && pass)) {
        res.status(400).send("All input is required");
    }

    db.query(`SELECT * FROM credentials WHERE email LIKE '${req.body.email}'`, (err, user) => {
        if (!user.length) {
            res.status(400).send("Invalid Credentials1");
        } else {
            bcrypt.compare(pass, user[0].pass, function (err, result) {
                if (result) {
                    const token = jwt.sign(
                        { user_id: user[0].id, email },
                        process.env.SECRET,
                        {
                            expiresIn: "4h",
                        }
                    );
                    user[0].token = token;
                    res.status(200).json(user);
                } else {
                    res.status(400).send("Invalid Credentials");
                }
            });
        }

    });

});


app.all('*', (req, res) => res.status(404).send('Requested resource not found on server.'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening at port ${PORT}`));