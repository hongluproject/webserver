/**
 * Created by gary on 14-9-28.
 */

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
// 例子：
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.Format = function(fmt)
{ //author: meizz
    var o = {
        "M+" : this.getMonth()+1,                 //月份
        "d+" : this.getDate(),                    //日
        "h+" : this.getHours(),                   //小时
        "m+" : this.getMinutes(),                 //分
        "s+" : this.getSeconds(),                 //秒
        "q+" : Math.floor((this.getMonth()+3)/3), //季度
        "S"  : this.getMilliseconds()             //毫秒
    };
    if(/(y+)/.test(fmt))
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
    for(var k in o)
        if(new RegExp("("+ k +")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
    return fmt;
}

exports.pad = function(num, n) {
    return (Array(n).join(0) + num).slice(-n);
}

exports.clanParam = {
    maxClanUsers:{
        1:10,
        2:50
    },
    maxCreateClan:{
        1:2,
        2:5
    }
};

/* @params:
    userId: user objectId, maybe null
    results: news result
   @return:wrapped promise result

    资讯查询返回内容包装：增加点赞
 */
exports.newsResultWapper = function(userId, results) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var newsIds = [];
    var likeTarget = {};	//记录该用户点过赞的id
    for (var i in results) {
        newsIds.push(results[i].id);

        //tags列表最多返回3个，否则前端会显示不下
        var tags = results[i].get('tags');
        if (tags && tags.length>3) {
            tags.splice(3, tags.length-3);
            results[i].set('tags', tags);
        }

        //返回cate名称
        var arrayCateName = [];
        var arrayCate = results[i].get('cateids');
        for (var k in arrayCate) {
            var name = '';
            if (HPGlobalParam.hpCates[arrayCate[k]]) {
                name = HPGlobalParam.hpCates[arrayCate[k]].get('cate_name');
            }
            arrayCateName.push(name);
        }
        if (arrayCateName.length) {
            results[i].set('catesName', arrayCateName);
        }

        //返回area名称
        var arrayAreaName = [];
        var arrayArea = results[i].get('areas');
        for (var k in arrayArea) {
            var name = '';
            if (HPGlobalParam.hpAreas[arrayArea[k]]) {
                name = HPGlobalParam.hpAreas[arrayArea[k]].get('title');
            }
            arrayAreaName.push(name);
        }
        if (arrayAreaName.length) {
            results[i].set('areasName', arrayAreaName);
        }

        //返回tags名称
        var arrayTagName = [];
        var arrayTag = results[i].get('tags');
        for (var k in arrayTag) {
            var name = '';
            if (HPGlobalParam.hpTags[arrayTag[k]]) {
                name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
            }
            arrayTagName.push(name);
        }
        if (arrayTagName.length) {
            results[i].set('tagsName', arrayTagName);
        }

    }

    if (userId && results && results.length) {
        //根据资讯&用户id，查询点赞信息
        var likeClass = AV.Object.extend("Like");
        var queryLike = new AV.Query(likeClass);
        queryLike.equalTo('like_type', 1);
        queryLike.equalTo('user_id', AV.User.createWithoutData('_User', userId));
        queryLike.containedIn('external_id', newsIds);
        return queryLike.find().then(function(likes) {
            for (var k in likes) {
                likeTarget[likes[k].get('external_id')] = likes[k].id;
            }
            //将所有动态返回，添加isLike，记录点赞状态
            for (var k in results) {
                var currNew = results[k];
                var likeObjectId = likeTarget[currNew.id];
                if (likeObjectId)	//添加点赞状态字段
                // currNew.set('isLike', true);
                    currNew.set('likeObjectId', likeObjectId);
            }

            return AV.Promise.as(results);
        });
    } else {
        return AV.Promise.as(results);
    }


}