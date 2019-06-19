//打印错误log到文件
let fs = require('fs'); // 引入fs模块
const logUtil = (msg, dir) => {
    const sd = require('silly-datetime');
    const time_flag = sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss');
    fs.writeFile(dir + '/errorLog.log', time_flag + ' : ' + msg + '\n', {
        'flag': 'a'
    }, err => {
        if (err) {
            console.log('输出日志失败');
            throw err;
        }
    })
}
const copyUtil = (file, to, newName, deleteSourse) => {
    let fs = require('fs');
    // 在复制目录前需要判断该目录是否存在，不存在需要先创建目录
    //需要层层判断，避免出现空路径
    let path = '';
    let des = to.split('/');
    for (let dir of des) {
        if (dir.length !== 0) {
            path += dir + '/';
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path);
            }
        }
    }
    let file_path;
    if (newName !== null) {
        //重命名
        let fileName = file.originalname.lastIndexOf("."); //取到文件名开始到最后一个点的长度
        let fileNameLength = file.originalname.length; //取到文件名长度
        let fileFormat = file.originalname.substring(fileName + 1, fileNameLength); //后缀
        file_path = to + '/' + newName + '.' + fileFormat
        fs.writeFileSync(file_path, fs.readFileSync(file.path));
    } else {
        file_path = to + '/' + file.originalname
        fs.writeFileSync(file_path, fs.readFileSync(file.path));
    }
    //fs.writeFileSync(to + '/' + newName == null ? file.originalname : newName, fs.readFileSync(file.path));
    //是否删除源文件
    if (deleteSourse) {
        fs.unlinkSync(file.path, err => {
            if (err) {
                console.log(err);
                throw err;
            }
        });
    }
    return file_path;
}

const ffmpeg = require('ffmpeg')
class FFMPEGOperation {
    constructor() {

    }
    //获取视频时长
    getVideoTotalDuration(videoPath) {
        const process = new ffmpeg(videoPath)
        return process.then(function (video) {
            // console.log('getVideoTotalDuration,seconds:' + video.metadata.duration.seconds)
            return video.metadata.duration.seconds || 0
        }, function (err) {
            // console.log('getVideoTotalDuration,err:' + err.message)
            return -1
        })
    }
    //获取视频缩略图
    getVideoSceenshots(videoPath, outPutPath, size, frameRate, frameCount) {
        const process = new ffmpeg(videoPath);
        return process.then(function (video) {
            video.fnExtractFrameToJPG(outPutPath, {
                size,
                every_n_frames: 20,
                number: frameCount,
                // file_name: 'frame_%t_%s'
                file_name: 'pic'
            }, function (error, files) {
                if (!error)
                    console.log('Frames: ' + files)
            })
        }, function (err) {
            console.log('Error: ' + err)
        })
    }
    //拆分视频
    splitVideo(videoPath, startTime, duration, outVideoPath) {
        const process = new ffmpeg(videoPath)
        return process.then(function (video) {
            video
                .setVideoStartTime(startTime)
                .setVideoDuration(duration)
                .save(outVideoPath, function (error, file) {
                    if (!error) {
                        console.log('Video file: ' + file)
                    }
                })
        }, function (err) {
            console.log('Error: ' + err)
        })
    }
}
//接口
module.exports = {
    logUtil,
    copyUtil,
    FFMPEGOperation
}