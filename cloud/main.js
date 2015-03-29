// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var qiniu = require('qiniu');
var common = require('cloud/common.js');
var myutils = require('cloud/utils');
var querystring = require('querystring');

//初始化avos相关参数，并每隔1小时更新一次数据
var globalParam = require('cloud/function/avosInitialize.js');
globalParam.initializeAvosData();

console.info('appId:%s', AV.applicationId);

/*
	require hook & function files
 */

require('cloud/hook/Like.js');
require('cloud/hook/News.js');
require('cloud/hook/NewsComment.js');
require('cloud/hook/DynamicNews.js');
require('cloud/hook/DynamicComment.js');
require('cloud/hook/ClanUser.js');
require('cloud/hook/Clan.js');
require('cloud/hook/_Followee.js');
require('cloud/hook/Activity.js');
require('cloud/hook/ActivityComment.js');
require('cloud/hook/ActivityUser.js');
require('cloud/hook/_User.js');
require('cloud/hook/ActivitySignUpUser.js');

require('cloud/function/imInterface.js');
require('cloud/function/dynamicWrapper.js');
require('cloud/function/newsWrapper.js');
require('cloud/function/recommend.js');
require('cloud/function/search.js');
require('cloud/function/clan.js');
require('cloud/function/statusWrapper.js');
require('cloud/function/activityWrapper.js');
require('cloud/function/imWrapper.js');
require('cloud/function/clanWrapper.js');
require('cloud/function/followeeWrapper.js');
require('cloud/function/sahalaScript.js');

/** 测试返回多个class数据
 *
 */
AV.Cloud.define("hello", function(req, res) {
	/*
	var pingpp = require('pingpp')(common.pingxxAppKey);
	pingpp.charges.createRefund(
		"ch_LGuvnT1CqLyHbzDK4GOiLmrP",
		{ amount: 1, description: "测试退款" },
		function(err, refund) {
			// YOUR CODE
			if (err) {
				console.error(err);
				res.error(err);
			} else {
				console.dir(refund);
				res.success(refund);
			}
		}
	);
	return;
	*/
	/*
	var followeeId = req.params.followee;
	var query = new AV.Query('_User');
	query.equalTo('objectId', req.user.id);

	for (var i=0; i<2; i++) {
		common.sendStatus('addFriend1', AV.User.createWithoutData('_User',followeeId), req.user, query);
	}

	return;
	*/
	/*
	var activityId = req.params.activityId;
	var activityName = req.params.activityName;

	//创建融云聊天室，用于实时导航
	var rcParam = myutils.getRongCloudParam();
	console.info('imAddToChatRoom:rong cloud param:%s', JSON.stringify(rcParam));

	var body = {};
	var chatroomId = 'chatroom-' + activityId;
	var key = 'chatroom[' + chatroomId + ']';
	body[key] = activityName;
	//通过avcloud发送HTTP的post请求
	AV.Cloud.httpRequest({
		method: 'POST',
		url: 'https://api.cn.rong.io/chatroom/create.json',
		headers: {
			'App-Key': rcParam.appKey,
			'Nonce': rcParam.nonce,
			'Timestamp': rcParam.timestamp,
			'Signature': rcParam.signature
		},
		body: querystring.stringify(body),
		success: function(httpResponse) {
			console.info('create chatroom:rong cloud response is '+httpResponse.text);
			if (httpResponse.data.code == 200)
				console.info('创建聊天室成功');
			else
				console.error('创建聊天室失败,code='+httpResponse.data.code);
		},
		error: function(httpResponse) {
			console.error('create chatroom failed,errCode:%d errMsg:%s', httpResponse.status, httpResponse.text);
		}
	});
	*/
	//查询融云群组
	var rcParam = myutils.getRongCloudParam();
	console.info('imAddToChatRoom:rong cloud param:%s', JSON.stringify(rcParam));

	/*
	//查询融云聊天室，用于实时导航
	var rcParam = myutils.getRongCloudParam();
	console.info('imAddToChatRoom:rong cloud param:%s', JSON.stringify(rcParam));

	var activityId = req.params.activityId;
	var body = {};
	body['chatroomId'] = 'chatroom-'+activityId;
	//通过avcloud发送HTTP的post请求
	AV.Cloud.httpRequest({
		method: 'POST',
		url: 'https://api.cn.rong.io/chatroom/query.json',
		headers: {
			'App-Key': rcParam.appKey,
			'Nonce': rcParam.nonce,
			'Timestamp': rcParam.timestamp,
			'Signature': rcParam.signature
		},
		body: querystring.stringify(body),
		success: function(httpResponse) {
			console.dir(httpResponse);
			console.info('query chatroom:rong cloud response is '+httpResponse.text);
			if (httpResponse.data.code == 200)
				console.info('查询聊天室成功');
			else
				console.error('查询聊天室失败,code='+httpResponse.data.code);

			res.success(httpResponse.data);
		},
		error: function(httpResponse) {
			console.error('create chatroom failed,errCode:%d errMsg:%s', httpResponse.status, httpResponse.text);
		}
	});
	*/

	/*
	var maxId = req.params.maxId || 0;
	var limit = req.params.limit || 100;
	var queryOr = [];
	var queryMsg = ['addFriend', 'addFriend1', 'addFriend2'];
	var userObj = req.user;
	var query;
	queryMsg.forEach(function(msgItem){
		query = AV.Status.inboxQuery(userObj, msgItem);
		query.notEqualTo('source', userObj);   //不包含自己发送的消息
		query.find(function(results){
			results.forEach(function(result){
				console.dir(result);
				//console.info('inboxType:%s messageId:%d', result.inboxType, result.messageId);
			})
		})
		queryOr.push(query);
	});

	return;

	query = new AV.InboxQuery(AV.Status);
	query._owner = userObj;
	query._orQuery(queryOr);
	query.include('source', 'clan', 'activity', 'statementAccount');
	query.limit(limit);
	query.maxId(maxId);
	query.find().then(function(results){
		results.forEach(function(result){
			console.dir(result);
		});
		res.success(results);
		console.info(results.length);
	}, function(err){
		res.error(err);
	});
	*/
});

/**  获取七牛云存储token
 *  云函数名：getQiniuToken
 *  参数：'bucketName',空间名，若没传，则默认为 'hoopeng'
 */
AV.Cloud.define('getQiniuToken', function(req, res){
	var bucketName = req.params.bucketName;
	console.log("bucketName param is %s", bucketName);
	if (!bucketName) {
		bucketName = "hoopeng";
	}

	//七牛的AK和SK
	qiniu.conf.ACCESS_KEY = 'bGJ2PX1QjaSuy4Y9AaX-WgcKoGzIIFHXmVBqWHMt';
	qiniu.conf.SECRET_KEY = '7PHdOXp912l54TYzG2P7Mmqw-AALLZ3Kaamv4885';
	var qiniuExpireTimeSecond = 7*24*3600;    //七牛过期时间，以秒为单位

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
		expire: qiniuExpireTimeSecond,
		token:uptoken(bucketName)
	}

	res.success(retObj);
});

/*
 /**	在用户注册成功后，做一些处理
 *
 AV.Cloud.afterSave('_User', function(request){
 var nickname = request.object.get('nickname');
 var invite_id = request.object.get('invite_id');
 console.info('_User afterSave:id:%s nickname:%s invite_id:%d', request.object.id, nickname, invite_id);
 if (nickname==undefined || nickname=='') {	//注册的时候没有带nickname，则需要为其补充一个
 }
 });
 */

/*
AV.Cloud.afterDelete('_User', function(request){
	console.info("enter afterDelete");
});
*/

/*
AV.Cloud.beforeSave("TestReview", function(request, response){
	if (request.object.get("stars") < 1) {
		response.error("you cannot give less than one star");
	} else if (request.object.get("stars") > 5) {
		response.error("you cannot give more than five stars");
	} else {
		var comment = request.object.get("comment");
		if (comment && comment.length > 140) {
			// Truncate and add a ...
			request.object.set("comment", comment.substring(0, 137) + "...");
		}
		response.success();
	}
});

AV.Cloud.afterSave("TestReview", function(request) {
	var query = new AV.Query("TestPost");
	query.get(request.object.get("post").id, {
		success: function(post) {
			post.increment("comments");
			post.save();
		},
		error: function(error) {
			throw "Got an error " + error.code + " : " + error.message;
		}
	});
});


AV.Cloud.afterSave("News", function(request) {
	var query = new AV.Query("TestPost");
	query.get(request.object.get("post").id, {
		success: function(post) {
			post.increment("comments");
			post.save();
		},
		error: function(error) {
			throw "Got an error " + error.code + " : " + error.message;
		}
	});
});
*/
