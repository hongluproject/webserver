// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js');
var myutils = require('cloud/utils.js');

AV.Cloud.define("hello", function(request, response) {
	response.success("Hello world," + request.params.userid);
});

/**
 * 获取融云token接口
 * @userobjid   用户objectid，通过该ID获取到用户信息，再向融云发起获取token请求
 */
AV.Cloud.define('getimtoken', function(req, res){

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

/**	在用户注册成功后，做一些处理
 *
 */
AV.Cloud.beforeSave('_User', function(request, response){
	var nickname = request.object.get('nickname');
	var invite_id = request.object.get('invite_id');
	console.info('_User beforeSave:id:%s nickname:%s invite_id:%d', request.object.id, nickname, invite_id);
	if (nickname==undefined || nickname=='') {	//注册的时候没有带nickname，则需要为其补充一个
		if (invite_id > 0) {
			nickname = '行者' + invite_id;
			request.object.set('nickname') = nickname;
		} else {

		}
	}

	response.success();
});

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