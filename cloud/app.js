// 在Cloud code里初始化express框架
var express = require('express');
var app = express();
var name = require('cloud/name.js');
var common = require('cloud/common.js');
var avosExpressHttpsRedirect = require('avos-express-https-redirect');

// App全局配置
//设置模板目录
if(__production)
	app.set('views', 'cloud/views');
else
	app.set('views', 'cloud/dev_views');
app.set('view engine', 'ejs');    // 设置template引擎

app.use(express.bodyParser());    // 读取请求body的中间件

app.use(avosExpressHttpsRedirect()); //启用HTTPS

//使用express路由API服务/hello的http GET请求
app.get('/hello', function(req, res) {
	res.render('hello', { message: 'Congrats, you just set up your app!' });
});


/*
 //测试CQL
AV.Query.doCloudQuery('select id0=row_number() over (partition by tag order by updateAt),* from interestList where id0<=3', {
    success: function(result){
        //results 是查询返回的结果，AV.Object 列表
        var results = result.results;
        results.forEach(function(item){
            console.dir(item);
        });
        console.log("count:" + result.count);
        //do something with results...
    },
    error: function(error){
        //查询失败，查看 error
        console.dir(error);
    }
});
*/

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
    console.info("view news:%s",articleId);
    var query = new AV.Query('News');
    query.equalTo('objectId', articleId);
    query.find().then(function(results){
        //根据传进来的articleId，找到对应的资讯记录
        if (!results || results.length<=0)
            return AV.Promise.error("news not found!");
        var tagIds = [];
        for(var i in results) {
            var obj = results[i];
            console.dir(obj);
            console.info(" id:" + obj.id);
            renderObj.title = obj.get('title');
            renderObj.publicDate = obj.get('publicAt');
            renderObj.newsContent = obj.get('contents');
            renderObj.fromWhere = obj.get('source'),
            tagIds = obj.get('tags');
            break;
        }

        //根据提供的tagid，查询到tag详细信息
        var queryTag = new AV.Query('Tag');
        queryTag.containedIn('objectId', tagIds);
        return queryTag.find();
    }).then(function(results){
        //根据资讯所属标签ID，找到对应的标签名称
        renderObj.tagList = new Array();
        console.info("print tagList");
        for(var i in results) {
            var obj = results[i];
            console.dir(obj);
            renderObj.tagList.push({
                tagId:obj.id,
                tagName:obj.get('tag_name')
            });
        }
        console.info('renderobject:');
        console.dir(renderObj);
        res.setHeader('cache-control','public, max-age=1800');
        res.render('article', renderObj);
    },function(err){
        console.dir(err);
        res.writeHead(404);
        res.end();
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
			res.render('500',500)
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

// This line is required to make Express respond to http requests.
app.listen({status:{maxAge:604800000}});


/*
//插入一些随机信息，用于测试
var tagNum = 10;
var dateBegin = new Date();
for (var i=0; i<3000; i++) {
    var interestList = AV.Object.extend("interestList");
    var iList = new interestList();
    console.log("current index " + i);
    iList.set("title", utils.randomString(32));
    iList.set("content", utils.randomString(100));
    iList.set("from", utils.randomString(10));
    iList.set("tag", Math.floor(Math.random()*tagNum));
    iList.save(null, {
        success: function(item) {
            // Execute any logic that should take place after the object is saved.
            console.log('New object created with objectId: ' + item.id);
        },
        error: function(item, error) {
            // Execute any logic that should take place if the save fails.
            // error is a AV.Error with an error code and description.
            console.log('Failed to create new object, with error code: ' + error.description);
        }
    });
}
var dateEnd = new Date();
console.log("use " + (dateEnd.getTime()-dateBegin.getTime()) +"ms to insert 1000 data .");
*/
