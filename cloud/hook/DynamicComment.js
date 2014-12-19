/**
 * Created by fugang on 14/12/11.
 */

/** 如果有新增的动态评论，动态表里面的评论数加1
 *
 */
AV.Cloud.afterSave('DynamicComment', function(request){
    var dynamicObj = request.object.get('dynamic_id');
    var commentUser = request.object.get('user_id');
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
            if (postUser.id == commentUser.id) {
                console.info('发布者和评论者是同一个人，不用发消息流:%s', postUser.id);
                return;
            }

            //向动态发布者发送事件流，告知他的动态被 commentUser 评论了
            var query = new AV.Query('_User');
            query.equalTo('objectId', postUser.id);

            var status = new AV.Status(null, '发表了评论！');
            status.data.source = commentUser._toPointer();
            status.query = query;
            status.set('messageType', 'newComment');
            status.set('dynamicNews', dynamicObj._toPointer());
            status.send().then(function(status){
                console.info('评论事件流发送成功！');
            },function(error) {
                console.error(error);
            });
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
