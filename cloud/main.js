// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
var name = require('cloud/name.js');
require('cloud/app.js')
AV.Cloud.define("hello", function(request, response) {
    console.log(request.user);
	response.success("Hello world," + request.params.name);
});

/**
 * 获取融云token接口
 * @userobjid   用户objectid，通过该ID获取到用户信息，再向融云发起获取token请求
 */
AV.Cloud.define('getimtoken', function(req, res){
	var ret = {
		status:"success",
	}

	//从body中取得userid，bodyparser有点问题，暂时写死一个
	var userobjid = '545b2a30e4b0d285a0ebf96f';//req.body.userid;
	console.log("userid:%s", userobjid);

	if (userobjid==undefined || userobjid=='') {
		ret.status = 'fail';
		ret.errmsg = 'user id not sent';
		res.json(ret);
		res.end();
		return;
	}

	//根据id查询用户表
	var hpUser = AV.Object.extend("_User");
	var query = new AV.Query(hpUser);
	query.get(userobjid, {
		success:function(userObj) {
			var username = userObj.get('nickname');
			var icon = userObj.get('icon');

			//融云校验信息
			var appSecret = rongCloudAppSecret; // 开发者平台分配的 App Secret。
			var nonce = Math.floor(Math.random()*100000); // 获取随机数。
			var nowTime = new Date();
			var timestamp = Math.floor(nowTime/1000); // 获取时间戳。

			var sourcedata = appSecret + nonce.toString() + timestamp.toString();
			var signature = common.SHA1(sourcedata); //生成签名

			console.log("nonce:%d timestamp:%d singature:%s source:%s", nonce, timestamp, signature, sourcedata);

			//通过avcloud发送HTTP的post请求
			AV.Cloud.httpRequest({
				method: 'POST',
				url: 'https://api.cn.rong.io/user/getToken.json',
				headers: {
					'App-Key': rongCloudAppKey,
					'Nonce': nonce,
					'Timestamp': timestamp,
					'Signature': signature
				},
				body: {
					userId:userobjid,
					name:username,
					portraitUri:icon
				},
				success: function(httpResponse) {
					console.log(httpResponse.text);
					ret.content = JSON.parse(httpResponse.text);
					console.log(ret);

					res.json(ret);
					res.end();
				},
				error: function(httpResponse) {
					console.error('Request failed with response code ' + httpResponse.status);

					ret.status = 'fail';
					ret.json(ret);
					res.end();
				}
			});
		},
		error:function(object,error) {
			// The object was not retrieved successfully.
			// error is a AV.Error with an error code and description.
			console.log(error);

			ret.status = 'fail';
			res.json(ret);
			res.end();
		}
	});
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
