// 在Cloud code里初始化express框架
var express = require('express');
var app = express();
var name = require('cloud/name.js');
var common = require('cloud/common.js');
var avosExpressHttpsRedirect = require('avos-express-https-redirect');
var qiniu = require('qiniu');
var utils = require('cloud/utils');

//七牛的AK和SK
qiniu.conf.ACCESS_KEY = 'bGJ2PX1QjaSuy4Y9AaX-WgcKoGzIIFHXmVBqWHMt';
qiniu.conf.SECRET_KEY = '7PHdOXp912l54TYzG2P7Mmqw-AALLZ3Kaamv4885';

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

//详情页
app.get('/article/:objid', function(req, res) {
    var articleid = req.param("objid");
    console.log(articleid);
    var interestList = AV.Object.extend("interestList");
    var query = new AV.Query(interestList);
    query.get(articleid, {
        success: function(obj) {
                console.log(" id:" + obj.id);
                var myContent = obj.get("content");
                myContent = myContent.replace("<html>", "").replace("</html>", "").replace("<head>", "").replace("</head>", "");
                res.render('article',{ content: myContent});
        },
        error: function(object, error) {
            console.log("Error: " + error.code + " " + error.message);
            res.send("404 file not foud!");
            res.end();
        }
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
//    var redirectfile = __dirname + '/../public/index.html';
//    filesLoad(redirectfile, "html", req, res);
//    res.redirect("/index.html");
    /*
    var myContent = '<html><head><meta property=\"wb:webmaster\" content=\"3cfad08e6e2c794b\" /></head><body>this is a test</body></html>';
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(myContent);
    res.end();
    */
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
app.listen();


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
