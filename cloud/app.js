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
        var tagNames = [];
        for (var i in tags) {
            var tagName = AV.HPGlobalParam.hpTags[tags[i]].get('tag_name');
            tagNames.push(tagName?tagName:'');
        }
        dynamicResult.set('tagNames', tagNames);

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
 *  部落分享
 */
app.get('/clan/:objId', function(req,res) {
    var clanId = req.param('objId');
    var invitationCode = req.param('invitation_id');
    if (!clanId) {
        console.error('clan id has not input!');
        res.writeHead(404);
        res.end();
    }


    var query = new AV.Query('Clan');
    query.get(clanId, {
        success: function(clanResult) {
            if (!clanResult) {
                console.error('clan %s has not found!', clanId);
                res.writeHead(404);
                res.end();
                return;
            }

            var tags = clanResult.get('tags');
            var tagNames = [];
            for (var i in tags) {
                var tagName = AV.HPGlobalParam.hpTags[tags[i]].get('tag_name');
                tagNames.push(tagName?tagName:'');
            }
            clanResult.set('tagNames', tagNames);

            var InvitationCode = AV.Object.extend("InvitationCode");
            var query = new AV.Query(InvitationCode);
            query.equalTo("invitationCode",invitationCode);
            var today=new Date();
            var t=today.getTime()-1000*60*60*24*7;
            var searchDate=new Date(t);
            query.greaterThan('createdAt',searchDate);
            query.include('userId');
            query.descending("createdAt");
            query.first({
                success: function(object) {
                    var optionUser = object.get('userId');
                    var userName = optionUser.get('nickname');
                    if(object){
                        res.render('clan', {clan:clanResult,user:userName,invitationCodeStatus:true});
                    }else{
                        res.render('clan', {clan:clanResult,user:userName,invitationCodeStatus:false});
                    }
                },
                error: function(error) {
                    console.error('clan %s has not found!', clanId);
                    res.writeHead(404);
                    res.end();
                    return;
                }
        });
        },
        error: function(error) {
            console.error('clan %s has not found!', clanId);
            res.writeHead(404);
            res.end();
            return;
        }
    });

});





/**
 *  活动分享
 */
app.get('/activity/:objId', function(req,res) {
    var invitationCode = req.param('invitation_id');
    var activityId = req.param('objId');
    if (!activityId) {
        console.error('activity id has not input!');
        res.writeHead(404);
        res.end();
    }
    var query = new AV.Query('Activity');
    query.include('user_id');
    query.get(activityId, {
        success: function(activityResult) {
            if (!activityResult) {
                console.error('activity %s has not found!', activityId);
                res.writeHead(404);
                res.end();
                return;
            }
            var tags = activityResult.get('tags');
            var tagNames = [];
            for (var i in tags) {
                if(AV.HPGlobalParam.hpTags[tags[i]]){
                    var tagName = AV.HPGlobalParam.hpTags[tags[i]].get('tag_name');
                    tagNames.push(tagName?tagName:'');
                }
            }
            activityResult.set('tagNames', tagNames);
            var InvitationCode = AV.Object.extend("InvitationCode");
            var query = new AV.Query(InvitationCode);
            query.equalTo("invitationCode",invitationCode);
            var today=new Date();
            var t=today.getTime()-1000*60*60*24*7;
            var searchDate=new Date(t);
            query.greaterThan('createdAt',searchDate);
            query.include('userId');
            query.descending("createdAt");
            query.first({
                success: function(object) {
                    var optionUser = object.get('userId');
                    query = new AV.Query('ActivityUser');
                    query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
                    query.limit(10);
                    query.include('user_id');
                    query.descending('createdAt');
                    query.find({
                        success: function(results){
                            if(object){

                                res.render('activity', {activity:activityResult,user:optionUser,invitationCodeStatus:true,activityUser:results});
                            }else{
                                res.render('activity', {activity:activityResult,user:optionUser,invitationCodeStatus:false,activityUser:results});
                            }
                        },
                        error: function(error){
                            console.log(error);
                            res.render('500',500);
                        }
                    });
                },
                error: function(error) {
                    console.error('activity %s has not found!', clanId);
                    res.writeHead(404);
                    res.end();
                    return;
                }
            });

        },
        error: function(error) {
            console.error('activity %s has not found!', activityId);
            res.writeHead(404);
            res.end();
            return;
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

/** pingxx交易异步通知（暂时不作用，由雪松那边的后台接收异步通知）
 *  post request body
 *  {
 *      pingxx charge object
 *  }
 */
app.post('/api/ping/notify', function(req, res){
    console.info('pingxx notify data:', req.body);

    var resp = function (ret, http_code) {
        http_code = typeof http_code == "undefined" ? 200 : http_code;
        res.writeHead(http_code, {
            "Content-Type": "text/plain;charset=utf-8"
        });
        res.end(ret);
    }

    var order;
    var notifyType = req.body.object;
    var query = new AV.Query('StatementAccount');
    query.include('signupId');
    switch(notifyType) {
        case 'charge':
            query.equalTo('serialNumber', req.body.id);
            break;

        case 'refund':
            query.equalTo('refundNumber', req.body.id);
            break;

        default:
            resp('fail');
            return;
    }
    query.first().then(function(result){
        if (!result) {
            resp('fail');
            return;
        }

        order = result;

        if (notifyType == 'charge') {
            if (req.body.paid) {
                // 支付完成，改写数据库支付状态、以及支付时间
                order.set('accountStatus', 2);
                order.set('paidTime', new Date(req.body.time_paid*1000));
                order.set('transactionNo', req.body.transaction_no);
            }
        } else if (notifyType == 'refund') {
            if (req.body.refunded) {
                //交易成功，回写账户当前支付状态
                order.set('accountStatus', 4);
            }
        }

        order.save();

        //先检测该记录是否已经存在,将该用户加入活动报名列表
        var user = order.get('userId');
        var activity = order.get('activityId');
        query = new AV.Query('ActivityUser');
        query.equalTo('user_id', user);
        query.equalTo('activity_id', activity);
        query.first().then(function(activityUser){
            if (activityUser) {
                console.info('用户已加入活动列表!');
                return;
            }

            //若不存在，添加AcvitityUser数据
            var signupInfo = order.get('signupId');
            var ActivityUser = AV.Object.extend('ActivityUser');
            var activityUser = new ActivityUser();
            activityUser.set('sex', signupInfo.get('sex'));
            activityUser.set('real_name', signupInfo.get('realName'));
            activityUser.set('phone', signupInfo.get('phone'));
            activityUser.set('idcard', signupInfo.get('idcard'));
            activityUser.set('signIn', 1);
            activityUser.set('passport_card', signupInfo.get('passportCard'));
            activityUser.set('two_way_permit', signupInfo.get('twoWayPermit'));
            activityUser.set('user_id', user._toPointer());
            activityUser.set('activity_id', activity._toPointer());
            activityUser.set('order_id', order._toPointer());
            activityUser.save();
        });

        resp('success');
    });

});

// This line is required to make Express respond to http requests.
app.listen({"static":{maxAge:2592000000}});
