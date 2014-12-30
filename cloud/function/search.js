/**
 * Created by fugang on 14/12/15.
 */


AV.Cloud.define("getSearch",function(req,res){
    var Dynamic = AV.Object.extend("DynamicNews");
    var Clan = AV.Object.extend("Clan");
    var User = AV.Object.extend("_User");
    var News = AV.Object.extend("News");
    var Tag = AV.Object.extend("Tag");


    //type  3 资讯 ,1 动态,2 问答,4 部落,5 人
    var  type = req.params.type.toString();
    var  kw  = req.params.kw;
    var  tagId = req.params.tagId;
    var  skip = req.params.skip || 0;
    var  limit = req.params.limit || 20;

    console.info('getSearch params,type:%d kw:%s tagId:%s skip:%d limit:%d',
        type, kw, tagId, skip, limit);

    //资讯
    var getNews =function(){
        var query = new AV.Query(News);
        query.select("title", "content_url","tags","objectId");
        query.limit(limit);
        query.skip(skip);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("title", kw);
        }
        query.find({
            success: function(result) {
                res.success(result);
            }
        });
    }

    //问答
    var getAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id", "content", "type","thumbs","up_count","comment_count","objectId");
        query.equalTo("type", 1);
        query.include('user_id');
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("content", kw);
        }
        query.limit(limit);
        query.skip(skip);
        query.include('user_id');
        query.find({
            success:function(results){
                if (results) {
                    for (var i in results) {
                        var currResult = results[i];
                        var currUser = currResult.get('user_id');
                        var retUser = AV.User.createWithoutData('_User', currUser.id);
                        retUser.set('nickname', currUser.get('nickname'));
                        retUser.set('tags', currUser.get('tags'));
                        var jValue = retUser._toFullJSON();
                        delete jValue.__type;
                        currResult.set('user_id', jValue);
                    }
                }
                res.success(results);
            }
        })
    }

    //动态
    var getDynamic = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","nickname", "content", "type","thumbs","up_count","comment_count","objectId");
        query.equalTo("type", 2);
        query.limit(limit);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("content", kw);
        }
        query.skip(skip);
        query.include('user_id');
        query.find({
            success:function(results){
                if (results) {
                    for (var i in results) {
                        var currResult = results[i];
                        var currUser = currResult.get('user_id');
                        var retUser = AV.User.createWithoutData('_User', currUser.id);
                        retUser.set('nickname', currUser.get('nickname'));
                        retUser.set('tags', currUser.get('tags'));
                        var jValue = retUser._toFullJSON();
                        delete jValue.__type;
                        currResult.set('user_id', jValue);
                    }
                }
                res.success(results);
            }
        })
    };

    //部落
    var getClan = function(){
        var query = new AV.Query(Clan);
        query.select("icon", "title","position","tags","objectId");
        query.limit(limit);
        query.skip(skip);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("title", kw);
        }
        query.find({
            success: function(result) {
                res.success(result);
            }
        });
    };

    //用户
    var getUser = function(){
        var query = new AV.Query(User);
        query.select("icon", "nickname","actual_position","tags","clanids","objectId");
        query.limit(limit);
        query.skip(skip);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("nickname", kw);
        }
        query.find({
            success: function(result) {
                res.success(result);
            }
        });
    };


    var switchTab  = function(type, res){
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
            default:
                console.error('未知的查询类型:'+type);
                res.error('未知的查询类型:'+type);
        }

    };

    if(tagId){
        switchTab(type, res);
    }else if(kw){
        var query = new AV.Query(Tag);
        query.select("objectId","tag_name");
        query.equalTo("tag_name", kw);
        query.first({
            success: function(result) {
                if(result){
                    tagId = result.id;
                }
                switchTab(type, res);
            },
            error:function(error) {
                console.error('query tagName error:%O', error);
                res.error('found tagName '+kw+' error!');
            }
        });
    }else {
        res.success([]);
    }

});