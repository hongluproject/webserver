/**
 * Created by gary on 2014/11/15.
 */
var crypto = require('crypto');
var common = require('cloud/common');
var _ = AV._;

exports.printObject = function() {
    console.log("hehe");
}

exports.randomString = function(len) {
    len = len || 32;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默认去掉了容易混淆的字符oOLl,9gq,Vv,Uu,I1****/
    var maxPos = $chars.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

exports.dumpObj = function(obj, name, indent, depth) {
    var MAX_DUMP_DEPTH = 10;
    if (depth > MAX_DUMP_DEPTH) {
        return indent + name + ": <Maximum Depth Reached>\n";
    }
    if (typeof obj == "object") {
        var child = null;
        var output = indent + name + "\n";
        indent += "\t";
        for (var item in obj) {
            try {
                child = obj[item];
            } catch (e) {
                child = "<Unable to Evaluate>";
            }
            if (typeof child == "object") {
                output += this.dumpObj(child, item, indent, depth + 1);
            } else {
                output += indent + item + ": " + child + "\n";
            }
        }
        return output;
    } else {
        return obj;
    }
}

/**
 *
 *  Secure Hash Algorithm (SHA1)
 *  http://www.webtoolkit.info/
 *
 **/

exports.SHA1 =  function (msg) {

    function rotate_left(n,s) {
        var t4 = ( n<<s ) | (n>>>(32-s));
        return t4;
    };

    function lsb_hex(val) {
        var str="";
        var i;
        var vh;
        var vl;

        for( i=0; i<=6; i+=2 ) {
            vh = (val>>>(i*4+4))&0x0f;
            vl = (val>>>(i*4))&0x0f;
            str += vh.toString(16) + vl.toString(16);
        }
        return str;
    };

    function cvt_hex(val) {
        var str="";
        var i;
        var v;

        for( i=7; i>=0; i-- ) {
            v = (val>>>(i*4))&0x0f;
            str += v.toString(16);
        }
        return str;
    };


    function Utf8Encode(string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    };

    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;

    msg = Utf8Encode(msg);

    var msg_len = msg.length;

    var word_array = new Array();
    for( i=0; i<msg_len-3; i+=4 ) {
        j = msg.charCodeAt(i)<<24 | msg.charCodeAt(i+1)<<16 |
        msg.charCodeAt(i+2)<<8 | msg.charCodeAt(i+3);
        word_array.push( j );
    }

    switch( msg_len % 4 ) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = msg.charCodeAt(msg_len-1)<<24 | 0x0800000;
            break;

        case 2:
            i = msg.charCodeAt(msg_len-2)<<24 | msg.charCodeAt(msg_len-1)<<16 | 0x08000;
            break;

        case 3:
            i = msg.charCodeAt(msg_len-3)<<24 | msg.charCodeAt(msg_len-2)<<16 | msg.charCodeAt(msg_len-1)<<8  | 0x80;
            break;
    }

    word_array.push( i );

    while( (word_array.length % 16) != 14 ) word_array.push( 0 );

    word_array.push( msg_len>>>29 );
    word_array.push( (msg_len<<3)&0x0ffffffff );


    for ( blockstart=0; blockstart<word_array.length; blockstart+=16 ) {

        for( i=0; i<16; i++ ) W[i] = word_array[blockstart+i];
        for( i=16; i<=79; i++ ) W[i] = rotate_left(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);

        A = H0;
        B = H1;
        C = H2;
        D = H3;
        E = H4;

        for( i= 0; i<=19; i++ ) {
            temp = (rotate_left(A,5) + ((B&C) | (~B&D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B,30);
            B = A;
            A = temp;
        }

        for( i=20; i<=39; i++ ) {
            temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B,30);
            B = A;
            A = temp;
        }

        for( i=40; i<=59; i++ ) {
            temp = (rotate_left(A,5) + ((B&C) | (B&D) | (C&D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B,30);
            B = A;
            A = temp;
        }

        for( i=60; i<=79; i++ ) {
            temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B,30);
            B = A;
            A = temp;
        }

        H0 = (H0 + A) & 0x0ffffffff;
        H1 = (H1 + B) & 0x0ffffffff;
        H2 = (H2 + C) & 0x0ffffffff;
        H3 = (H3 + D) & 0x0ffffffff;
        H4 = (H4 + E) & 0x0ffffffff;

    }

    var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);

    return temp.toLowerCase();

}

exports.getRongCloudParam = function() {
    //融云appkey & secret
    var rongCloudAppKey = 'pwe86ga5er6m6';
    var rongCloudAppSecret = 'ScUoRd65VLv';

    //如果是DEV环境，则需要用融云的测试key
    if (common.isSahalaDevEnv()) {
        rongCloudAppKey = '4z3hlwrv3fl9t';
        rongCloudAppSecret = 'NmT0nxJblVO05i';
    }

    //融云校验信息
    var appSecret = rongCloudAppSecret; // 开发者平台分配的 App Secret。
    var nonce = Math.floor(Math.random()*100000); // 获取随机数。
    var nowTime = new Date();
    var timestamp = Math.floor(nowTime/1000); // 获取时间戳。

    var sourcedata = appSecret + nonce.toString() + timestamp.toString();
    var signature = exports.SHA1(sourcedata); //生成签名

    return {
        appKey:rongCloudAppKey,
        nonce:nonce,
        timestamp:timestamp,
        signature:signature
    };
}

exports.calcStatusSignature = function(userId, messageType, statusTime) {
    var md5 = crypto.createHash('md5');
    var content = userId+messageType+statusTime;
    md5.update(content);
    return md5.digest('hex');
}

exports.printAbnormalityActivity = function() {
    var query = new AV.Query('Activity');
    query.limit(1000);
    var printfVal = {};
    var outputVal = [];

    function printValue() {
        outputVal = _.sortBy(outputVal, function(item){
            return -item.createdAt.getTime();
        });
        outputVal.forEach(function(printItem){
            console.error('ActivityUser error %s,current_num is %d,real count is %d, createAt %d %s',
                printItem.title,
                printItem.currNum,
                printItem.realNum,
                printItem.createdAt.getTime(),
                printItem.createdAt);
        })
    }

    query.find().then(function(results){
        var count = results && results.length || 0;
        for (var i in results) {
            var activity = results[i];
            var joinUsers = activity.get('joinUsers');
            var joinUsersNum = joinUsers&&joinUsers.length || 0;
            var joinNum = activity.get('current_num') || 0;
            var numInfo = {
                title:activity.get('title'),
                currNum:joinNum,
                joinUsersNum:joinUsersNum,
                createdAt:activity.createdAt
            };
            printfVal[activity.id] = numInfo;


            queryUser = new AV.Query('ActivityUser');
            queryUser.equalTo('activity_id', activity);
            queryUser.find().then(function(activityUsers){
                --count;
                if (!activityUsers || !activityUsers.length) {
                    if (count == 0) {
                        printValue();
                    }
                    return;
                }
                var activityIn = activityUsers[0].get('activity_id');
                var numInfo = printfVal[activityIn.id];
                var joinNum = numInfo.currNum;
                var userCount = (activityUsers&&activityUsers.length) || 0;
                numInfo.realNum = userCount;
                if (userCount!=joinNum) {
                    outputVal.push(numInfo);
                }

                if (count == 0) {
                    printValue();
                }
            });
        };
    });
}