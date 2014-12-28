// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var qiniu = require('qiniu');

//初始化avos相关参数
var globalParam = require('cloud/function/avosInitialize.js');
globalParam.initializeAvosData();

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

require('cloud/function/imInterface.js');
require('cloud/function/dynamicWrapper.js');
require('cloud/function/newsWrapper.js');
require('cloud/function/recommend.js');
require('cloud/function/search.js');
require('cloud/function/clan.js');
require('cloud/function/statusWrapper.js');

/** 测试返回多个class数据
 *
 */
AV.Cloud.define("hello", function(request, response) {
	var query = new AV.Query('ClanUser');
	query.include('clan_id', 'user_id');
	query.find().then(function(results) {
		for (var i in results) {
			var jValue = results[i].get('clan_id')._toFullJSON();
			delete jValue.__type;
			results[i].set('clan_id', jValue);
		}
		response.success(results);
	});
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
