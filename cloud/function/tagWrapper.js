/**
 * Created by fugang on 15/5/30.
 */
var common = require('cloud/common');
var _ = AV._;

/*
    获取标签列表
        函数名:getTags
    参数:
        无
    返回:
    {
        tagDirectory:[TagDirectory class object],
        tags:[Tag class object]
    }
 */
AV.Cloud.define('getTags', function(req, res){
    var limit = req.params.limit || 100;
    var skip = req.params.skip || 0;

    var promises = [];
    var query = new AV.Query('TagDirectory');
    query.select('-tagIds');
    query.ascending('tagSort');
    promises.push(query.find());

    query = new AV.Query('Tag');
    query.ascending('level');
    query.addDescending('rank');
    query.addDescending('createdAt');
    query.equalTo('status', 1);
    query.limit(1000);
    promises.push(query.find());

    AV.Promise.when(promises).then(function(tagDirectories, tags){
        var ret = {
            tagDirectory:[],
            tags:[]
        }
        _.each(tagDirectories, function(item){
            ret.tagDirectory.push(item._toFullJSON());
        });

        _.each(tags, function(item){
            ret.tags.push(item._toFullJSON());
        });

        res.success(ret);
    });
});