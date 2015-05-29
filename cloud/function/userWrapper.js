/**
 * Created by fugang on 15/4/22.
 */
var _ = AV._;

/*
    用户激活请求，在用户进入动态首页时调用
    函数名：
        userActivate
    参数：
        userId:objectId  当前用户ID
    返回：
        {
            showFindDynamic:bool 是否显示发现
        }
 */
AV.Cloud.define('userActivate', function(req, res){
    var user = req.user;
    var userId = req.params.userId || (user && user.id);
    if (!userId || !user) {
        res.error('您尚未登录!');
        return;
    }

    var retVal = {};
    var lastLoginAt = user.get('lastLoginAt');
    var nowDate = new Date();
    if (!lastLoginAt) {
        retVal.showFindDynamic = true;
    } else {
        var friendCount = user.get('friendCount');
        var days = Math.floor((nowDate.getTime()-lastLoginAt.getTime())/(24*3600*1000));
        if (friendCount<10 && days>7) {
            //好友数小于10，并且超过7天没有登录，则提示他弹出发现动态
            retVal.showFindDynamic = true;
        }
    }

    user.set('lastLoginAt', nowDate);
    user.save();
    res.success(retVal);
});

/*
    举报内容
        函数名:reportContent
    参数：
        userId: objectId 举报人，若不传，则为当前登录用户
        type: Integer 举报目标类型
            0:动态 默认
            1:部落
            2:活动
            3:精选
        reportReason:Integer 举报原因
            1:色情
            2:广告
            3:骗钱
            4:违法
            0:其他 默认
        targetId:object 举报目标ID
    返回:
        success:
            {
                report: Report class object
            }
        fail:
            error message

 */
AV.Cloud.define('reportContent', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    var type = req.params.type || 0;
    var reportReason = req.params.reportReason || 0;
    var targetId = req.params.targetId;

    switch (type) {
        case 0:
            var query = new AV.Query('DynamicNews');
            break;
        case 1:
            var query = new AV.Query('Clan');
            break;
        case 2:
            var query = new AV.Query('Activity');
            break;
        case 3:
            var query = new AV.Query('News');
            break;
    }
    if (!query) {
        res.error('举报类型未知!');
        return;
    }
    var reportURL;
    query.get(targetId).then(function(result){
        if (!result) {
            return AV.Promise.error('举报信息不存在!');
        }
        reportURL = result.get('share_url') || result.get('shareUrl') || result.get('contents_url');

        //查询对应的举报对象是否已经存在
        query = new AV.Query('Report');
        query.equalTo('userId', userId);
        query.equalTo('reportObjectId', targetId);
        return query.first();
    }).then(function(reportObj){

        if (!reportObj) {
            var ReportClass = AV.Object.extend('Report');
            reportObj = new ReportClass();
        }
        reportObj.set('type', type);
        reportObj.set('reportType', reportReason);
        reportObj.set('reportObjectId', targetId);
        reportObj.set('userId', AV.User.createWithoutData('User', userId));
        reportObj.set('reportLink', reportURL);
        return reportObj.save();
    }).then(function(result){
        if (!result) {
            return AV.Promise.error('保存举报信息失败!');
        }

        res.success({
            report:result._toFullJSON()
        });
    }).catch(function(err){
        if (_.isString(err)) {
            res.error(err);
        } else {
            res.error('举报失败，错误码:'+err.code);
        }
    });
});

/*
    将用户列入黑名单
        函数名：addUserToBlacklist
    参数：
        userId:objectId
 */
AV.Cloud.define('addUserToBlacklist', function(req, res){

});