/**
 * Created by fugang on 14/12/11.
 */

/** 如果有新增的动态评论，动态表里面的评论数加1
 *
 */
AV.Cloud.afterSave('DynamicComment', function(request){
    var dynamicObj = request.object.get('dynamic_id');
    console.dir(dynamicObj);
    dynamicObj.increment('comment_count');
    dynamicObj.save();
});

/** 有动态评论删除时，动态表里面的评论数减1
 *
 */
AV.Cloud.afterDelete('DynamicComment', function(request){
    var dynamicObj = request.object.get('dynamic_id');
    dynamicObj.increment('comment_count', -1);
    dynamicObj.save();
});
