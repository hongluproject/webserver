// 在Cloud code里初始化express框架
var express = require('express');
var app = express();
var name = require('cloud/name.js');
var common = require('cloud/common.js');
//var avosExpressHttpsRedirect = require('avos-express-https-redirect');

// App全局配置
//设置模板目录
if(__production)
	app.set('views', 'cloud/views');
else
	app.set('views', 'cloud/dev_views');
app.set('view engine', 'ejs');    // 设置template引擎

app.use(express.bodyParser());    // 读取请求body的中间件

//app.use(avosExpressHttpsRedirect()); //启用HTTPS

//使用express路由API服务/hello的http GET请求
app.get('/hello', function(req, res) {
	res.render('hello', { message: 'Congrats, you just set up your app!' });
});

app.get('/qiniutoken', function(req,res) {
    function uptoken(bucketname) {
        var putPolicy = new qiniu.rs.PutPolicy(bucketname);
        //putPolicy.callbackUrl = callbackUrl;
        //putPolicy.callbackBody = callbackBody;
        //putPolicy.returnUrl = returnUrl;
        //putPolicy.returnBody = returnBody;
        //putPolicy.asyncOps = asyncOps;
        putPolicy.expires = qiniuExpireTimeSecond;  //7天过期
        return putPolicy.token();
    }

    var retObj = {
        status:"success",
        expire: qiniuExpireTimeSecond,
        token:uptoken('hoopeng')
    }

    res.json(retObj);
    res.end();
});

//列表页
app.get('/articleList', function(req, res) {
    var interestList = AV.Object.extend("interestList");
    var query = new AV.Query(interestList);
    query.skip(0);
    query.limit(100);
    query.descending('updatedAt');
    query.find({
        success: function(results){
            res.render('articleList',{ articleList: results});
        },
        error: function(error){
            console.log(error);
            res.send("404 file not foud!");
            res.end();
        }
    });
});

/** 访问资讯详情页
 *  @param: objid  资讯objectId
 */
app.get('/news/:objId', function(req, res) {
    var renderObj = {};
    var articleId = req.param("objId");
    if (!articleId) {
        console.error('article id has not input!');
        res.writeHead(404);
        res.end();
        return;
    }
    var globalObj = AV.HPGlobalParam || {};
    var hpTags = globalObj.hpTags || {};

    console.info("begin find news:%s", articleId);
    var query = new AV.Query('News');
    query.equalTo('objectId', articleId);
    query.find().then(function(results){
        //根据传进来的articleId，找到对应的资讯记录
        if (!results || results.length<=0)
            return AV.Promise.error("news not found!");
        var tagIds = [];
        for(var i in results) {
            var obj = results[i];
            console.info(" id:" + obj.id);
            renderObj.title = obj.get('title');
            var publicAt = obj.get('publicAt');
            renderObj.publicDate = publicAt.getFullYear() + '-' +
                    common.pad((publicAt.getMonth()+1),2) + '-' +
                    common.pad((publicAt.getDate()),2);
            renderObj.newsContent = obj.get('contents');
            renderObj.fromWhere = obj.get('source'),
            tagIds = obj.get('tags');

            break;
        }

        renderObj.tagList = new Array();
        for (var i in tagIds) {
            renderObj.tagList.push({
                tagId:tagIds[i],
                tagName:hpTags[tagIds[i]]?hpTags[tagIds[i]].get('tag_name'):""
            });
        }
        res.setHeader('cache-control','public, max-age=1800');
        res.render('article', renderObj);
        console.info('render article %s', articleId);

    }, function(err){
        console.error('Render article error:', err);
        res.writeHead(404);
        res.end();
    });
});

/** 访问动态详情
 *  @param: objid 动态objectId
 */
app.get('/dynamic/:objId', function(req, res) {
    var dynamicId = req.param("objId");
    if (!dynamicId) {
        console.error('dynamic id has not input!');
        res.writeHead(404);
        res.end();
        return;
    }
    var renderObj = {};

    console.info('dynamic id:%s', dynamicId);

    //获取动态详情
    var query = new AV.Query('DynamicNews');
    query.include('user_id');
    query.get(dynamicId).then(function(dynamicResult) {
        if (!dynamicResult) {
            console.error('dynamic %s not found', dynamicId);
            res.writeHead(404);
            res.end();
        }

        //加标签名
        var tags = dynamicResult.get('tags');
        var tagsName = [];
        for (var i in tags) {
            var tagName = AV.HPGlobalParam.hpTags[tags[i]].get('tag_name');
            tagsName.push(tagName?tagName:'');
        }
        dynamicResult.set('tagsName', tagsName);
        console.dir(tagsName);

        renderObj = dynamicResult;
        //获取该动态最近10个评论
        var queryComment = new AV.Query('DynamicComment');
        queryComment.equalTo('dynamic_id', AV.Object.createWithoutData('DynamicNews', dynamicId));
        queryComment.include('user_id', 'reply_userid');
        queryComment.limit(10); //取最近10条
        queryComment.descending('createdAt');
        return queryComment.find();
    }, function(error) {
        console.error('dynamic id %s find error:', dynamicId, error);
        res.writeHead(404);
        res.end();
    }).then(function(commentResults) {
        renderObj.set('comments', commentResults);
        return AV.Promise.as(renderObj);
    }, function(error) {
        return AV.Promise.as(renderObj);
    }).then(function(renderResult){
        res.render('dynamic', {dynamic:renderResult});
    });
});

/**
 *  活动详情
 */
app.get('/activity/:objId', function(req,res) {
    var activityId = req.param('objId');
    if (!activityId) {
        console.error('activity id has not input!');
        res.writeHead(404);
        res.end();
    }

    var query = new AV.Query('Activity');
    query.include('user_id');
    query.get(activityId).then(function(activityResult) {
        if (!activityResult) {
            console.error('activity %s has not found!', activityId);
            res.writeHead(404);
            res.end();
            return;
        }

        var tags = activityResult.get('tags');
        var tagsName = [];
        for (var i in tags) {
            var tagName = AV.HPGlobalParam.hpTags[tags[i]].get('tag_name');
            tagsName.push(tagName?tagName:'');
        }
        activityResult.set('tagsName', tagsName);
        res.render('activity', {activity:activityResult});
    });
});

/**
 *      测试返回json
 */
app.get('/jobj', function(req, res) {
   var retObj = {
      a:1,
      b:2
   } ;
    res.json(retObj);
});

var Visitor = AV.Object.extend('Visitor');
function renderIndex(res, name){
	var query = new AV.Query(Visitor);
	query.skip(0);
	query.limit(10);
	query.descending('createdAt');
	query.find({
		success: function(results){
			res.render('index',{ name: name, visitors: results});
		},
		error: function(error){
			console.log(error);
			res.render('500',500);
		}
	});

}

app.get('/', function(req, res){
//    res.redirect('http://honglu.qiniudn.com/index.html');
//    res.sendfile('http://honglu.qiniudn.com/index.html');
    res.sendfile('./public/index.html');
});

/**
 *
 */
app.post('/',function(req, res){
var name = req.body.name;
	if(name && name.trim() !=''){
		//Save visitor
		var visitor = new Visitor();
		visitor.set('name', name);
		visitor.save(null, {
			success: function(gameScore) {
				res.redirect('/?name=' + name);
			},
			error: function(gameScore, error) {
				res.render('500', 500);
			}
		});
	}else{
		res.redirect('/');
	}
});

/* test code
var queryUser = new AV.Query('_User');
queryUser.get('54abc651e4b0154cef59f695').then(function(user){
    user.unset('clanids');
    user.save();
});
*/

// This line is required to make Express respond to http requests.
app.listen({"static":{maxAge:2592000000}});
