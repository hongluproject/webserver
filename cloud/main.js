// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var myutils = require('cloud/utils.js');
var qiniu = require('qiniu');

/*
	require hook & function files
 */
require('cloud/hook/Like.js');
require('cloud/hook/News.js');
require('cloud/hook/NewsComment.js');
require('cloud/hook/DynamicNews.js');
require('cloud/hook/DynamicComment.js');
require('cloud/hook/ClanUser.js');
require('cloud/function/imInterface.js');

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





AV.Cloud.define("imGetSearch",function(req,res){
    var Dynamic = AV.Object.extend("DynamicNews");
    var Clan = AV.Object.extend("Clan");
    var User = AV.Object.extend("_User");
    var News = AV.Object.extend("News");

    //type  3 资讯 ,1 动态,2 问答,4 部落,5 人
    var  type = req.params.type;
    var  kw  = req.params.kw;
    var  tagId = req.params.tagId;


    //资讯
    var getNews =function(){
        var query = new AV.Query(News);
        query.select("title", "content_url","tags","objectId");
        query.limit(2);
        query.find({
            success: function(result) {
                res.success(result);
            },
            error:function(userObj,error) {
            }
        });
    }

    //问答
    var getAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId");
        query.equalTo("type", 1);
        query.include('user_id');
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                res.success(result);
            },
            error:function(){
            }
        })
    }

    //动态
    var getDynamic = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id");
        query.skip(2); // skip the first 10 results
        query.equalTo("type", 2);
        query.limit(2);
        query.include('user_id');
        query.collection({
            success:function(result){
                res.success(result);
             },
            error:function(){
            }
        })
    };

    //部落
    var getClan = function(){
        var query = new AV.Query(Clan);
        query.select("icon", "title","position","tags","objectId");
        query.limit(2);
        query.find({
            success: function(result) {
                res.success(result);
            },
            error:function(userObj,error) {
            }
        });
    };

    //用户
    var getUser = function(){
        var query = new AV.Query(User);
        query.select("icon", "nickname","actual_position","tags","clanids","objectId");
        query.limit(2);
        query.find({
            success: function(result) {
                res.success(result);
            },
            error:function(userObj,error) {
            }
        });
    };
    //type  3 资讯 ,1 动态,2 问答,4 部落,5 人
    switch(type)
    {
        case "3":
            getNews();
            break;
        case "1":
            getDynamic();
            break;
        case "2":
            getAsk();
            break;
        case "4":
            getClan();
            break;
        case "5":
            getUser();
            break;
    }

})

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
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId");
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 1);
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                var askResult = [];
                for (var i = 0; i < result.length; i++) {
                    var user =  result[i].get("user_id");
                    var outChannel = {};
                    outChannel       = result[i];
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
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId");
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 2);
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                var dynamicResult = [];
                for (var i = 0; i < result.length; i++) {
                    var outChannel = {};
                    outChannel       = result[i];
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
            query.select("icon", "title","position","tags","objectId");
            query.equalTo("tags", tags[index]);
            query.near("position", userGeoPoint);
            query.limit(2);
            query.find({
                success: function(result) {
                    var clanResult = [];
                    for (var i = 0; i < result.length; i++) {
                        var outChannel = {};
                        outChannel       = result[i];
                        clanResult.push(outChannel);
                    }
                    ret.recommendClan = clanResult;
                    getRecommendDynamic();
                    return;
                },
                error:function(userObj,error) {
                    ret.recommendClan = [];
                    getRecommendDynamic();
                    return;
                }
            });
        }else{
            ret.recommendClan = [];
            getRecommendDynamic();
            return;
        }
    }

    var  getRecommendUser = function(){
        if(userid){
            var query = new AV.Query(User);
            query.get(userid, {
                success:function(userObj) {
                    var userGeoPoint = userObj.get("actual_position");
                    var query = new AV.Query(User);
                    query.select("icon", "nickname","actual_position","tags","clanids","objectId");
                    query.near("actual_position", userGeoPoint);
                    query.notEqualTo("objectId", userid);
                    query.equalTo("tags", tags[index]);
                    query.limit(2);
                    query.find({
                        success: function(result) {
                            var userResult = [];
                            for (var i = 0; i < result.length; i++) {
                                var outChannel = {};
                                outChannel       = result[i];
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
 *  获取动态
 */
AV.Cloud.define('getDynamic', function(req,res){
	var dynamicType = req.params.dynamicType || 'followeDynamic';	//获取的动态类型
	switch (dynamicType) {
		case "followeDynamic":	//查询我关注的动态，需要通过事件流查询
			/**	request param
			  {
			  	dynamicType:followeDynamic,
			  	limit:N default is 20,
			  	maxId:N default is zero
			  }
			 */
			var userId = req.params.userId;
			if (!userId) {
				res.error('缺少用户信息！');
				return;
			}
			var limit = req.params.limit || 20;
			var maxId = req.params.maxId || 0;
			var statusesReturn = [];	//保存第一次查询返回的status
			var likeTarget = {};	//记录该用户点过赞的id
			var returnUserItem = {	//动态中发布者信息，可以保留返回的字段
				objectId:1,
				username:1,
				nickname:1,
				className:1,
				icon:1,
				__type:1
			};

			//查询事件流，获取用户关注的所有动态
			var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
			query.include('dynamicNews');
			query.include('source');
			query.include('dynamicNews.user_id');
			query.equalTo('messageType', 'newPost');
			query.limit(limit);
			query.maxId(maxId);
			query.exists('dynamicNews');
			query.find().then(function(statuses){
				//获取所有动态objectId，再查询该用户对这些动态是否点过赞
				var dynamicIdArray = [];
				for (var i in statuses) {
					if (statuses[i].data.dynamicNews) {
						dynamicIdArray.push(statuses[i].data.dynamicNews.objectId);
						statusesReturn.push(statuses[i]);
					}
				}

				//查询点赞表
				var likeClass = AV.Object.extend("Like");
				var likeQuery = new AV.Query(likeClass);
				likeQuery.containedIn('external_id', dynamicIdArray);
				likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
				likeQuery.find();
			}, function(err){
				//查询失败
				console.dir(err);
				res.error('查询关注动态信息失败！');
			}).then(function(likes){
				for (var i in likes) {
					likeTarget[likes[i].external_id] = true;
				}

				//将所有动态返回，添加isLike，记录点赞状态
				for (var i in statusesReturn) {
					var currDynamic = statusesReturn[i].data.dynamicNews;
					if (likeTarget[currDynamic.objectId] == true)	//添加点赞状态字段
						currDynamic.isLike = true;
					else
						currDynamic.isLike = false;

					//遍历user_id，去掉不需要返回的字段，减少网络传输
					for (var k in currDynamic.user_id) {
						if (returnUserItem[k] != 1) {
							delete currDynamic.user_id[k];
						}
					}
				}

				res.success(statusesReturn);
			}, function(error){
				res.error('查询点赞状态失败');
			});

			break;
	}
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
