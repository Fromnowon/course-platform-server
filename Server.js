//引入express的模块
let express = require('express');
let bodyParser = require('body-parser');
const captcha = require('svg-captcha');
const sd = require('silly-datetime');
let session = require('express-session');
let fs = require('fs');
const LOG_DIR = './log'; //日志目录
const {
    sqlQuery
} = require('./model/db');
const {
    logUtil,
    copyUtil,
    FFMPEGOperation
} = require('./model/util')
//创建实例
let app = express();

//静态文件
// http://exapmle.com/static.file
app.use(express.static('./public'));
//seesion中间件
app.use(session({
    secret: 'secret', // 对session id 相关的cookie 进行签名
    resave: true,
    saveUninitialized: false, // 是否保存未初始化的会话
    cookie: {
        maxAge: 1000 * 60 * 3, // 设置 session 的有效时间，单位毫秒
    },
}))
//
app.get('/', function (req, res, next) {
    res.send('Wrong request!\n')
    next();
})
//鉴权
app.get('/authenticate', function (req, res, next) {
    Authenticate(req, res);
})
//注册
app.post('/reg', bodyParser.json(), (req, res, next) => {
    let data = req.body;
    // console.log(data);
    if (data.captcha == req.session.captcha) {
        //验证码正确
        let sqlParam = null;
        let sqlString = null;
        //查重
        sqlParam = {
            username: data.username
        };
        sqlString = 'SELECT * FROM `user` WHERE ?';
        sqlQuery(sqlString, sqlParam).then(rs => {
                if (rs.length !== 0) {
                    //已存在用户名
                    res.json({
                        code: -2,
                        msg: '用户名冲突'
                    })
                } else {
                    sqlParam = {
                        id: 'default',
                        username: data.username,
                        password: data.password,
                        name: data.name,
                        email: data.email,
                        role: 'default',
                        reg_date: sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
                    };
                    sqlString = 'INSERT INTO `user` SET ?';
                    sqlQuery(sqlString, sqlParam).then(rs => {
                        // console.log(rs);
                        res.json({
                            code: 1,
                            msg: '注册成功'
                        });
                    }).catch(err => {
                        console.log(err);
                        res.json({
                            code: -1,
                            msg: '注册信息写入失败'
                        });
                    })
                }
            })
            .catch(err => {
                //已存在用户名
                res.json({
                    code: -1,
                    msg: '数据库执行错误'
                })
            })
    } else {
        res.json({
            code: -1,
            msg: '验证码错误'
        });
    }
    //next();
})
//登录
app.post('/login', bodyParser.json(), (req, res, next) => {
    let data = req.body;
    // console.log(data);
    sqlQuery('SELECT * FROM `user` WHERE `username`=? AND `password`=?', [
            data.username,
            data.password
        ]).then(results => {
            if (results.length === 0) {
                res.json({
                    code: -1,
                    msg: '用户名或密码错误！'
                })
            } else {
                let rs = JSON.parse(JSON.stringify(results));
                // console.log(rs)
                //保存session
                req.session.account = JSON.stringify(rs[0]);
                res.json({
                    code: 0,
                    msg: rs[0]
                })
            }
        })
        .catch(err => {
            res.json({
                code: -1,
                msg: '数据库执行错误'
            })
        })

});
//注销
app.get('/logout', (req, res, next) => {
    delete req.session.account;
    res.send('Cache deleted');
});
//获取验证码
app.get('/captcha', (req, res, next) => {
    const cap = captcha.create(req.query);
    // 保存到session,忽略大小写
    req.session["captcha"] = cap.text.toLowerCase();
    res.send(cap.data);
    next();
});
//上传信息
app.post('/uploadInfo', bodyParser.json(), function (req, res, next) {
    //鉴权
    let role
    if (req.session.account != undefined) {
        role = JSON.parse(req.session.account).role;
    } else {
        role = -1;
    }
    if (role < 2) {
        //权限不足
        res.json({
            code: -1,
            msg: '操作权限不足'
        })
    } else {
        //入库
        let data = req.body;
        let sqlString = 'INSERT INTO `course` SET ?';
        let sqlParam = {
            id: 'default',
            uploader_id: JSON.parse(req.session.account).id,
            title: data.title,
            description: data.description,
            grade: data.grade,
            tags: data.tags.length ? JSON.stringify(data.tags) : null,
            dir: null,
            duration: null,
            cover: 'default',
            status: 0,
            upload_date: sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
        };
        sqlQuery(sqlString, sqlParam)
            .then(rs => {
                //写入session以备撤销
                req.session.insertId = rs.insertId;
                res.json({
                    code: 1,
                    msg: ''
                })
            })
            .catch(err => {
                console.log(err);
                res.json({
                    code: -1,
                    msg: '保存课程信息失败'
                })
            })
    }

})
//上传文件
let multer = require('multer');
// 通过 filename 属性定制
let upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            let dir = 'upload/' + req.sessionID;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, (err) => {
                    if (err) {
                        res.json({
                            code: -1,
                            msg: '创建目录失败'
                        });
                        logUtil('[upload/' + req.sessionID + ']' + '无法创建对应目录', LOG_DIR)
                        return;
                    }
                });
            }
            cb(null, dir); // 保存的路径，备注：需要自己创建
        },
        filename: function (req, file, cb) {
            // 保存文件名设置
            cb(null, file.originalname);
        }
    })
});
app.post('/uploadFile', upload.any(), function (req, res, next) {
    //整理
    let dir = 'upload/' + req.sessionID;
    for (let l = req.files.length, i = 0; i < l; i++) {
        copyUtil(req.files[i], i === 0 ? (dir + '/course') : (dir + '/attachments'), true); //第一个文件为课程视频，其余归类为附件
    }
    sqlQuery('UPDATE `course` SET ?', {
        dir,
        status: 1
    }).then(rs => {
        res.json({
            code: 1,
            msg: rs.insertId //返回课程id
        })
    }).catch(err => {
        console.log(err);
        res.json({
            code: -1,
            msg: '数据库写入失败  '
        })
    })
});
//中断，删除相关数据
app.get('/uploadCancel', (req, res) => {
    //数据库
    let sqlString = "DELETE FROM `course` WHERE ?";
    let sqlParam = {
        id: req.session.insertId
    };
    sqlQuery(sqlString, sqlParam).then(rs => {
        //文件
        deleteFolder('upload/' + req.sessionID);
    });
})
//设定监听端口, 和回调函数
app.listen(9001, function afterListen() {
    console.log('express running on http://localhost:9001');
});
app.get('/lastest', (req, res) => {
    sqlQuery("SELECT * FROM `course` ORDER BY `id` DESC limit 5", {}).then(rs => {
        res.json({
            code: 1,
            msg: JSON.stringify(rs)
        })
    })
})

/* 
***
公共函数区
***
*/

// const mediaHandler = new FFMPEGOperation();
// console.log(mediaHandler.getVideoTotalDuration('upload/F8ZI2Ys4RJfWcogA8VmS1hL9faYXabI7/course/窈窕淑女.rmvb'))
const mediaHandler = new FFMPEGOperation();
mediaHandler.getVideoTotalDuration('upload/F8ZI2Ys4RJfWcogA8VmS1hL9faYXabI7/course/窈窕淑女.rmvb').then(rs => {
    console.log(rs);
})


//鉴权
function Authenticate(req, res) {
    res.json({
        code: 1,
        msg: ''
    })
    return;
    console.log(req.session);
    //鉴权
    let role
    if (req.session.account != undefined) {
        role = JSON.parse(req.session.account).role;
    } else {
        role = -1;
    }
    if (role < 2) {
        //权限不足
        res.json({
            code: -1,
            msg: '操作权限不足'
        })
    } else {
        res.json({
            code: 1,
            msg: ''
        })
    }
}

//删除文件夹
function deleteFolder(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolder(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}