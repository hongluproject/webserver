// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var qiniu = require('qiniu');
var common = require('cloud/common.js');
var myutils = require('cloud/utils');
var querystring = require('querystring');
var _ = AV._;
var Promise = AV.Promise;

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
require('cloud/function/userWrapper.js');
require('cloud/function/tagWrapper.js');

/** 测试返回多个class数据
 *
 */
AV.Cloud.define("hello", function(req, res) {
	var userId = req.user && req.user.id;
	var nowDate = new Date();

	var destroyActivityUser = function() {
		var query = new AV.Query('ActivityUser');
		query.equalTo('activity_id', AV.Object.createWithoutData('Activity', common.getMountaineerClubActivityId()));
		query.skip(0);
		query.limit(500);
		console.info('begin find');
		query.destroyAll().then(function(){
			console.info('delete ok');
			destroyActivityUser();
		}).catch(function(){
			res.success('ok');
		});
	}

//	destroyActivityUser();
	var modifyUser = function() {
		var query = new AV.Query('User');
		query.get('555b4785e4b07617344c8d1f').then(function(user){
			if (!user) {
				return AV.Promise.error('用户不存在!');
			}

			return AV.Cloud.httpRequest({
				'url':'https://api.leancloud.cn/1.1/classes/_User/'.concat(user.id),
				'method':'PUT',
				'headers':{
					'X-AVOSCloud-Application-Id':AV.applicationId,
					'X-AVOSCloud-Application-Key':AV.applicationKey,
					'Content-Type':'application/json',
					'X-AVOSCloud-Session-Token':'pnktnjyb996sj4p156gjtp4im'
				},
				'body':{
					'status':2
				}
			});
		}).then(function(result){
			console.dir(result);
		}).catch(function(err){
			console.error(err);
		});
	}

	var userId = req.params.userId;
	var query = new AV.Query('User');
	query.equalTo('objectId', userId);
	query.first().then(function(user){
		var icon = user.get('icon');
		if (!_.isUndefined() && _.isEmpty(icon)) {
			user.fetchWhenSave(true);
			user.unset('icon');
			return user.save();
		} else {
			return Promise.as();
		}
	}).then(function(user){
		res.success(user);
	}).catch(function(err){
		console.error(err);
		res.error(err);
	});

});

/*
 获取七牛云存储上传token
 云函数名：getQiniuToken
 参数：
	 bucketName: string 空间名，若没传，则默认为 'hoopeng'
 返回：{
	 expire:Integer 从当前时间开始的过期时间，以秒为单位
	 token:string	七牛上传token
 }
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
