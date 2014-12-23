/**
 * Created by fugang on 14/12/22.
 */

/** 返回用户所在、以及推荐的部落
 *
 */
AV.Cloud.define('getClan', function(req, res) {
    var getRecommendClan = function(position,userObj) {

    }
    var userId = req.params.userId;
    var positon = req.params.position;
    /**
     *  如果有传用户ID，则：
     *  1、查询该用户信息，找到用户的标签，再随机推荐2个和他相同标签的部落。
     *  2、返回给用户已经加入的标签
     *
     *  若未传用户ID，则：
     *  1、判断用户传过来的标签，和他已经加入的部落ID，随机推荐2个他相同标签，并且尚未加入的部落
     *
     */
    if (userId) {
        var queryUser = new AV.Query('_User');
        queryUser.get(userId, {
            success:function(user) {

            }
        });
    } else {    //没有用户信息，直接返回推荐的部落
        var interestTags = req.params.interestTags || [];
        if (interestTags.length > 0) { //随机选一个标签

        }
    }
});