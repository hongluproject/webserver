/**
 * Created by fugang on 14/12/11.
 */
var utils = require('cloud/utils.js');
var common = require('cloud/common.js');

/** 如果有新增的动态评论，动态表里面的评论数加1
 *
 */
AV.Cloud.afterSave('DynamicComment', function(request){
    var dynamicObj = request.object.get('dynamic_id');
    var commentUser = request.object.get('user_id');
    var replyUser = request.object.get('reply_userid');
    if (!dynamicObj || !commentUser) {
        console.error('DynamicComment 数据非法！');
        return;
    }
    console.dir(dynamicObj);

    //get dynamic object first
    var queryDynamic = new AV.Query('DynamicNews');
    queryDynamic.get(dynamicObj.id, {
        success:function(dynamic) {
            if (!dynamic) {
                console.error('没有找到对应的动态数据:%s', dynamicObj.id);
                return;
            }
            dynamic.increment('comment_count');
            dynamic.addUnique('commentUsers', commentUser.id);
            dynamic.save();

            var postUser = dynamic.get('user_id');
            if (postUser.id==commentUser.id && !replyUser) {
                console.info('发布者和评论者是同一个人，不用发消息流:%s', postUser.id);
                return;
            }

            //向动态发布者发送事件流，告知他的动态被 commentUser 评论了
            var query = new AV.Query('_User');
            if (replyUser) {
                var userIds = [postUser.id, replyUser.id];
                query.containedIn('objectId', userIds);
            } else {
                query.equalTo('objectId', postUser.id);
            }
            common.sendStatus('newComment', commentUser, postUser, query, {dynamicNews:dynamicObj,replyUser:replyUser});
        }
    })
});

/** 有动态评论删除时，动态表里面的评论数减1
 *
 */
AV.Cloud.afterDelete('DynamicComment', function(request){
    var dynamicObj = request.object.get('dynamic_id');
    var dynamicQuery = AV.Query('DynamicNews');
    dynamicQuery.get(dynamicObj.id, {
        success:function(dynamicResult) {
            //评论数量必须大于0，才允许减1
            if (dynamicResult && dynamicResult.get('comment_count')>0) {
                dynamicObj.increment('comment_count', -1);
            }
            dynamicObj.remove('comments', request.object.id);
            dynamicObj.save();
        }
    });
});
