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