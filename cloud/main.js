// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var myutils = require('cloud/utils.js');
var qiniu = require('qiniu');

/** 测试返回多个class数据
 *
 */
AV.Cloud.define("hello", function(request, response) {
	var ret = {
		recommendUser:{},
		systemPost:{},
		friendPost:{}
	};

	var step3 = function() {
		response.success(ret);
	};

	//查找推荐
	var step2 = function() {
		var News = AV.Object.extend("News");
		var query = new AV.Query(News);
		query.limit = 10;
		query.find({
			success:function(results){
				console.info("user result count:%d", results.length);
				ret.systemPost = results;

				step3();
			},
			error:function(error){
				step3();
			}
		});
	};

	//查找推荐的用户
	var step1 = function() {
		var user1 = AV.Object.extend("_User");
		var query = new AV.Query(user1);
		query.limit = 5;
		query.find({
			success:function(results){
				console.info("user result count:%d", results.length);
				ret.recommendUser = results;

				step2();
			},
			error:function(error){
				step2();
			}
		});
	};

	step1();

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


AV.Cloud.define("imGetClanUser",function(req, res){
    var clan_id = req.params.clan_id;
    var Clan = AV.Object.extend("Clan");
    var ClanUser = AV.Object.extend("ClanUser");
    var query = new AV.Query(ClanUser);
    var clan_user = [];
    var myClan = new Clan();
    myClan.set("objectId", clan_id);
    query.equalTo("clan_id", myClan);
    query.include("user_id");
    query.include("clan_id");
    query.find({
        success: function(result) {
            var finalResult = [];
            for (var i = 0; i < result.length; i++) {
                var outChannel = {};
                var user =  result[i].get("user_id");
                var clan =  result[i].get("clan_id");
                //this level belong to table ClanUser
                outChannel.userIcon     =  user.get("icon");
                outChannel.userNickName =  user.get("nickname")
                outChannel.userObjectId =  user.id;
                outChannel.clanName =  clan.get("title");
                outChannel.clanIcon =  clan.get("icon");
                finalResult.push(outChannel);
            }
            res.success(finalResult);
            },
        error: function(error) {
            alert("Error: " + error.code + " " + error.message);
        }

    });

});




//todo  优化获取的字段，优化在没有人物ID时的需求
AV.Cloud.define("imGetRecommend",function(req, res){
    //共用
    var tags = req.params.tags;
    var index = Math.floor((Math.random()*tags.length));
    var userid = req.params.userid;
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var Dynamic = AV.Object.extend("DynamicNews");
    var ret = {
        recommendUser:{},
        recommendClan:{},
        recommendDynamic:{},
        recommendAsk:{}
    };
    var getRecommendAsk = function(){
        var query = new AV.Query(Dynamic);
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 1);
        query.limit(2);
        query.find({
            success:function(result){
                var askResult = [];
                for (var i = 0; i < result.length; i++) {
                    var user =  result[i].get("user_id");
                    var outChannel = {};
                    outChannel.content       = result[i].get("content");
                    outChannel.userIcon       = user.get("icon");
                    outChannel.userNickName       = user.get("nickname");
                    outChannel.type          = result[i].get("type");
                    outChannel.thumbs          = result[i].get("thumbs");
                    outChannel.upCount          = result[i].get("up_count");
                    outChannel.commentCount          = result[i].get("comment_count");
                    outChannel.dynamicObjectId  =  result[i].id;
                    outChannel.createdAt  =  result[i].createdAt;
                    askResult.push(outChannel);
                }
                ret.recommendAsk = askResult;
                res.success(ret);
            },
            error:function(){
                ret.recommendAsk = [];
                res.success(ret);
            }
        })
    }


    var getRecommendDynamic = function(){
        var query = new AV.Query(Dynamic);
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 2);
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                var dynamicResult = [];
                for (var i = 0; i < result.length; i++) {
                    var user =  result[i].get("user_id");
                    var outChannel = {};
                    outChannel.content       = result[i].get("content");
                    outChannel.userIcon       = user.get("icon");
                    outChannel.userNickName       = user.get("nickname");
                    outChannel.type          = result[i].get("type");
                    outChannel.thumbs          = result[i].get("thumbs");
                    outChannel.upCount          = result[i].get("up_count");
                    outChannel.commentCount          = result[i].get("comment_count");
                    outChannel.dynamicObjectId  =  result[i].id;
                    outChannel.createdAt  =  result[i].createdAt;
                    dynamicResult.push(outChannel);
                }
                ret.recommendDynamic = dynamicResult;
                getRecommendAsk();
            },
            error:function(){
                ret.recommendDynamic = [];
                getRecommendAsk();
            }
        })
    }

    var getRecommendClan = function(userObj){
        if(userObj){
            var userGeoPoint = userObj.get("actual_position");
            var clanids        = userObj.get("clanids");
            var query = new AV.Query(Clan);
            if(clanids!=undefined){
                query.notContainedIn("objectId", clanids);
            }
            query.equalTo("tags", tags[index]);
            query.near("position", userGeoPoint);
            query.limit(2);
            query.find({
                success: function(result) {
                    var clanResult = [];
                    for (var i = 0; i < result.length; i++) {
                        var outChannel = {};
                        outChannel.clanIcon      =  result[i].get("icon");
                        outChannel.clanTitle  =  result[i].get("title")
                        outChannel.clanPosition = result[i].get("position");
                        outChannel.userTags       = result[i].get("tags");
                        outChannel.clanObjectId  =  result[i].id;
                        clanResult.push(outChannel);
                    }
                    ret.recommendClan = clanResult;
                    getRecommendDynamic();
                },
                error:function(userObj,error) {
                    ret.recommendClan = [];
                    getRecommendDynamic();
                }
            });
        }else{
            ret.recommendClan = [];
            getRecommendDynamic();
        }
    }

    var  getRecommendUser = function(){
        if(userid){
            var query = new AV.Query(User);
            query.get(userid, {
                success:function(userObj) {
                    var userGeoPoint = userObj.get("actual_position");
                    var query = new AV.Query(User);
                    query.near("actual_position", userGeoPoint);
                    query.notEqualTo("objectId", userid);
                    query.equalTo("tags", tags[index]);
                    query.limit(2);
                    query.find({
                        success: function(result) {
                            var userResult = [];
                            for (var i = 0; i < result.length; i++) {
                                var outChannel = {};
                                outChannel.userIcon      =  result[i].get("icon");
                                outChannel.userNickName  =  result[i].get("nickname")
                                outChannel.userActualPosition = result[i].get("actual_position");
                                outChannel.userObjectId  =  result[i].id;
                                outChannel.userTags       = result[i].get("tags");
                                userResult.push(outChannel);
                            }
                            ret.recommendUser = userResult;
                            getRecommendClan(userObj);
                            return;
                        }
                    });
                },
                error:function(userObj,error) {
                    ret.recommendUser = [];
                    getRecommendClan(userObj);
                    return;
                }
            });
        }else{
            ret.recommendUser = [];
            getRecommendClan();
            return;
        }
    }
    getRecommendUser();
});



/**
 * 获取融云token接口
 * @userobjid   用户objectid，通过该ID获取到用户信息，再向融云发起获取token请求
 */
AV.Cloud.define('imGetToken', function(req, res){
	//请求参数检查
	var userobjid = req.params.userid;
	if (userobjid ==  undefined) {
		console.error('getimtoken:userid is undefined');
		res.error('userid is expected!');
		return;
	}

	console.info("getimtoken:userid:%s", userobjid);

	//根据id查询用户表
	var hpUser = AV.Object.extend("_User");
	var query = new AV.Query(hpUser);
	query.get(userobjid, {
		success:function(userObj) {
			var username = userObj.get('nickname');
			var icon = userObj.get('icon');

			var rcParam = myutils.getRongCloudParam();
			console.info("getimtoken:nonce:%d timestamp:%d singature:%s", rcParam.nonce, rcParam.timestamp, rcParam.signature);

			//通过avcloud发送HTTP的post请求
			AV.Cloud.httpRequest({
				method: 'POST',
				url: 'https://api.cn.rong.io/user/getToken.json',
				headers: {
					'App-Key': rcParam.appKey,
					'Nonce': rcParam.nonce,
					'Timestamp': rcParam.timestamp,
					'Signature': rcParam.signature
				},
				body: {
					userId:userobjid,
					name:username,
					portraitUri:icon
				},
				success: function(httpResponse) {
					console.info('getimtoken:rongcloud response is '+httpResponse.text);

					delete httpResponse.data.code;
					res.success(httpResponse.data);
				},
				error: function(httpResponse) {
					var errmsg = 'Request failed with response code ' + httpResponse.status;
					console.error('getimtoken:'+errmsg);
					res.error(errmsg);
				}
			});
		},
		error:function(object,error) {
			// The object was not retrieved successfully.
			// error is a AV.Error with an error code and description.
			console.log(error);

			var errmsg = 'query object fail:' + error.code;

			res.error(errmsg);
		}
	});
});

/**  加入聊天群组，具体使用场景：
 * 		用户申请加入部落，长老批准通过后，即可调用此接口，将该用户加入聊天群组
 *	@param {
 *		"userid":用户objectId
 	*	"groupid":群组id
    *	"groupname":群组名称
 *  }
 */
AV.Cloud.define('imAddToGroup', function(request, response){
	//read request body first
	var userid = request.params.userid;
	var groupid = request.params.groupid;
	var groupname = request.params.groupname;

	//请求参数检查
	//userid or groupid cann't be empty
	if (userid==undefined || groupid==undefined) {
		console.error("imAddToGroup:userid:%s groupid:%s", userid,groupid);
		response.error('请求参数异常！');
		return;
	}
	console.info('imAddToGroup:userid:%s groupid:%s groupname:%s', userid, groupid, groupname);

	//校验用户是否存在，根据id查询用户表
	var hpUser = AV.Object.extend("_User");
	var query = new AV.Query(hpUser);
	query.get(userid, {
		success:function(userObj) {
			var rcParam = myutils.getRongCloudParam();

			console.info('imAddToGroup:rong cloud param:%s', JSON.stringify(rcParam));

			//通过avcloud发送HTTP的post请求
			AV.Cloud.httpRequest({
				method: 'POST',
				url: 'https://api.cn.rong.io/group/join.json',
				headers: {
					'App-Key': rcParam.appKey,
					'Nonce': rcParam.nonce,
					'Timestamp': rcParam.timestamp,
					'Signature': rcParam.signature
				},
				body: {
					userId:userid,
					groupId:groupid,
					groupName:groupname
				},
				success: function(httpResponse) {
					console.info('imAddToGroup:rong cloud response is '+httpResponse.text);
					if (httpResponse.data.code == 200)
						response.success('加入聊天群组成功');
					else
						response.error('加入聊天群组失败,code='+httpResponse.data.code);
				},
				error: function(httpResponse) {
					var errmsg = 'Request failed with response code ' + httpResponse.status;
					console.error('imAddToGroup:'+errmsg);
					response.error(errmsg);
				}
			});
		},
		error:function(object, error) {
			console.error('用户id：%s 不存在！', userid);
			response.error('用户不存在');
		}
	});

	//check weather group  has  exist
});

/** 将某用户id从某组群id中去除
 * 	使用场景：部落长老，将某用户从部落中剔除，该用户也同时从部落中删除
 *	@param {
 *	"userid":用户id
 *	"groupid":群组id
 *}
 *
 */
AV.Cloud.define('imQuitGroup', function(request, response){
	//read request body first
	var userid = request.params.userid;
	var groupid = request.params.groupid;

	//请求参数检查
	if (userid==undefined || groupid==undefined) {
		console.error('imQuitGroup:userid:%s groupid:%s', userid, groupid);
		response.error('请求参数异常！');
		return;
	}
	console.info("imQuitGroup:userid:%s groupid:%s", userid, groupid);

	//校验用户是否存在，根据id查询用户表
	var hpUser = AV.Object.extend("_User");
	var query = new AV.Query(hpUser);
	query.get(userid, {
		success:function(userObj) {
			var rcParam = myutils.getRongCloudParam();

			console.info('imQuitGroup:rong cloud param:%s', JSON.stringify(rcParam));

			//通过avcloud发送HTTP的post请求
			AV.Cloud.httpRequest({
				method: 'POST',
				url: 'https://api.cn.rong.io/group/quit.json',
				headers: {
					'App-Key': rcParam.appKey,
					'Nonce': rcParam.nonce,
					'Timestamp': rcParam.timestamp,
					'Signature': rcParam.signature
				},
				body: {
					userId:userid,
					groupId:groupid
				},
				success: function(httpResponse) {
					console.info('imQuitGroup:rong cloud response is '+httpResponse.text);
					if (httpResponse.data.code == 200)
						response.success('退出聊天群组成功');
					else
						response.success('退出聊天群组失败,code='+httpResponse.data.code);
				},
				error: function(httpResponse) {
					var errmsg = 'Request failed with response code ' + httpResponse.status;
					console.error('imQuitGroup:'+errmsg);
					response.error(errmsg);
				}
			});
		},
		error:function(object, error) {
			console.error('用户id：%s 不存在！', userid);
			response.error('用户不存在');
		}
	});
});

/** 将某组群id解散
 * 	使用场景：某部落不再使用，在删除该部落的同时，删除其对应的聊天组群
 *	@param {
 *  "userid":操作解散用户id
 *	"groupid":群组id
 *}
 *
 */
AV.Cloud.define('imDismissGroup', function(request, response){
	//read request body first
	var userid = request.params.userid;
	var groupid = request.params.groupid;

	//请求参数检查
	if (userid==undefined || groupid==undefined) {
		console.error('imDismissGroup:userid:%s groupid:%s', userid, groupid);
		response.error('请求参数异常！');
		return;
	}
	console.info("imDismissGroup:userid:%s groupid:%s", userid, groupid);

	var rcParam = myutils.getRongCloudParam();
	console.info('imDismissGroup:rong cloud param:%s', JSON.stringify(rcParam));

	//通过avcloud发送HTTP的post请求
	AV.Cloud.httpRequest({
		method: 'POST',
		url: 'https://api.cn.rong.io/group/dismiss.json',
		headers: {
			'App-Key': rcParam.appKey,
			'Nonce': rcParam.nonce,
			'Timestamp': rcParam.timestamp,
			'Signature': rcParam.signature
		},
		body: {
			userId:userid,
			groupId:groupid
		},
		success: function(httpResponse) {
			console.info('imDismissGroup:rong cloud response is '+httpResponse.text);
			if (httpResponse.data.code == 200)
				response.success('解散聊天群组成功');
			else
				response.success('解散聊天群组失败,code='+httpResponse.data.code);
		},
		error: function(httpResponse) {
			var errmsg = 'Request failed with response code ' + httpResponse.status;
			console.error('imDismissGroup:'+errmsg);
			response.error(errmsg);
		}
	});

});

/** 发布动态后，通知到所有关注我的人
 *
 */
AV.Cloud.afterSave('DynamicNews', function(request){
	var postUser = request.object.get('user_id')._toPointer();
	if (!postUser) {
		console.info("DynamicNews afterSave:user is null!");
		return;
	}
	console.dir(postUser);

	var status = new AV.Status(null, '发布了动态！');
	status.data.source = postUser;
	status.set('messageType', 'newPost');
	status.set('dynamicNews', request.object._toPointer());
	//先将此消息也发一份给自己，便于首页动态里面，可以看到自己
	var user = AV.Object.extend('_User');
	var query = new AV.Query(user);
	query.equalTo('objectId', postUser.objectId);
	status.query = query;
	status.send().then(function(status){
		//发送成功
		console.info("%s 发布动态给自己成功!", postUser.objectId);
		console.dir(status);
	}, function(err){
		//发送失败
		console.info("%s 发布动态给自己失败!", postUser.objectId);
		console.dir(err);
	});

	//再将此消息发送给所有我的关注者（粉丝），让他们可以看到我的动态
	AV.Status.sendStatusToFollowers(status).then(function(status){
		//发布状态成功，返回状态信息
		console.info("%s 发布动态给粉丝成功!", postUser.objectId);
		console.dir(status);
	}, function(err){
		//发布失败
		console.error("%s 发布动态给粉丝失败!", postUser.objectId);
		console.dir(err);
	});

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

/** 如果有新增的资讯评论，资讯表里面的评论数加1
 *
 */
/*
AV.Cloud.afterSave('NewsComment', function(request, response){
	var query = new AV.Query("News");
	query.get(request.object.get("newsid").id, {
		success: function(news) {
			console.info("NewsComment afterSave comment_count increment");
			news.increment("comment_count");
			news.save();
		},
		error: function(error) {
			console.error( "NewsComment afterSave:Got an error " + error.code + " : " + error.message);
		}
	});
});

AV.Cloud.afterDelete('NewsComment', function(request){
	var query = new AV.Query("News");
	query.get(request.object.get("newsid").id, {
		success: function(news) {
			console.info("NewsComment afterSave comment_count increment");
			if (news.get("comment_count") > 0) {	//评论次数大于0，才能做递减操作
				news.increment("comment_count");
				news.save();
			}
		},
		error: function(error) {
			console.error( "NewsComment afterDelete:Got an error " + error.code + " : " + error.message);
		}
	});
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
