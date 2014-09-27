// 在Cloud code里初始化express框架
var express = require('express');
var app = express();
var name = require('cloud/name.js');
var avosExpressHttpsRedirect = require('avos-express-https-redirect');

// App全局配置
//设置模板目录
if(__production)
	app.set('views', 'cloud/views');
else
	app.set('views', 'cloud/dev_views');
app.set('view engine', 'ejs');    // 设置template引擎
app.use(avosExpressHttpsRedirect()); //启用HTTPS
app.use(express.bodyParser());    // 读取请求body的中间件

//使用express路由API服务/hello的http GET请求
app.get('/hello', function(req, res) {
	res.render('hello', { message: 'Congrats, you just set up your app!' });
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

var mime = {
    "html" : "text/html",
    "css"  : "text/css",
    "js"   : "text/javascript",
    "json" : "application/json",
    "ico"  : "image/x-icon",
    "gif"  : "image/gif",
    "jpeg" : "image/jpeg",
    "jpg"  : "image/jpeg",
    "png"  : "image/png",
    "pdf"  : "application/pdf",
    "svg"  : "image/svg+xml",
    "swf"  : "application/x-shockwave-flash",
    "tiff" : "image/tiff",
    "txt"  : "text/plain",
    "wav"  : "audio/x-wav",
    "wma"  : "audio/x-ms-wma",
    "wmv"  : "video/x-ms-wmv",
    "xml"  : "text/xml"
};

// FServer.js
var fs   = require('fs');
function filesLoad(filePath, type, req, res){
    fs.exists(filePath, function(exists){
        if ( !exists ) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            // res.write();
            res.end();
        } else {
            fs.readFile(filePath, 'binary', function(err, file){
                if ( err ) {
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    // res.write();
                    res.end();
                } else {
                    res.writeHead(200, {'Content-Type': mime[type]});
                    res.write(file, 'binary');
                    res.end();
                }
            });
        }
    });
}
exports.filesLoad = filesLoad;

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
    res.sendfile('public/index.html');

});

/*
app.get('/', function(req, res){
	var name = req.query.name;
	if(!name)
		name = 'AVOS Cloud';
	renderIndex(res, name);
});
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
