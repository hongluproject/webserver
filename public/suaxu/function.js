/*
常用的公共函数以及对象

**/

//扩展日期对象,输出格式化的字符串
Date.prototype.format = function(fmt){  //args:yyyy-mm-dd hh:MM:ss
  var o = {
	"m+" : this.getMonth()+1,                 //月份
	"d+" : this.getDate(),                    //日
	"h+" : this.getHours(),                   //小时
	"M+" : this.getMinutes(),                 //分
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

//扩展日期对象,时间对象进行加减运算
Date.prototype.add=function(obj){ //args:{"year":1,"day":-1}
	var y=this.getFullYear(),m=this.getMonth()+1,days=this.getDate(),d=0;
	if(typeof obj !='object'){return this;}
	for(var q in obj){
		if(q=='year'){
			y += obj[q];
		}else if(q=='month'){
			m += obj[q];
			if(m>12){
				   y += parseInt(m/12);
				   m=m%12;
			}
			if(m<1){
				   y += parseInt(m/12)-1;
				   m=12+m%12;
			}
		}else if(q=='day'){
			d += obj[q];
		}
	}
	return new Date(new Date(y+"/"+m+"/"+days).getTime()+d*24*60*60*1000);
}

//根据日期获取时间信息：totalDays  year ageType
function getTimeInfo(dateStart, dateEnd){ //age: BirthDt,DateStart
    dateStart = typeof dateStart == 'string' ? new Date(dateStart.replace(/-/g,'/')) : dateStart;
    dateEnd = typeof dateEnd == 'string' ? new Date(dateEnd.replace(/-/g,'/')) : dateEnd;
    var info = {};
    info.totalDays = (dateEnd.getTime() - dateStart.getTime())/1000/60/60/24+1;
    info.year = dateEnd.getFullYear() - dateStart.getFullYear()-((dateEnd.getMonth() < dateStart.getMonth()|| dateEnd.getMonth() == dateStart.getMonth() && dateEnd.getDate() < dateStart.getDate())?1:0);
    info.ageType = info.year >= 18 ? 'adult' : 'child';
    return info;
}

// 判断是否证件号重复
function judgeInsIDNo(IdNo, insData, editIndex){  //IdNo  ,insData:被保险人列表,  editIndex : 编辑的index
      var hasIdNo = false;
      if(insData && insData.length > 0){
         for(var i = 0;i < insData.length; i++){
            if(editIndex !== undefined){
                if(editIndex != i && IdNo == insData[i]['IdNo']){
                    hasIdNo = true;
                    break;
                }
            }else{
                if(IdNo == insData[i]['IdNo']){
                    hasIdNo = true;
                    break;
                }
            }
         }
      }
      return hasIdNo;
}

//校验邮箱
function checkMail(val){
	var flag = /^([a-zA-Z0-9]+[_|\_|\.|\-]+?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.|\-]+?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/.test(val);
	//var flag = /^([a-zA-Z0-9]+[_|\_|\.|\-]+?)*[a-zA-Z0-9]+([a-zA-Z0-9]+[_|\_|\.|\-]+?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/.test(val);
	return flag;
}

//校验手机号码
function checkTel(val){
	var flag = /^(((13[0-9]{1})|(15[0-9]{1})|(18[0-9]{1}))+\d{8})$/.test(val);
	return flag;
}

//检测身份证号码正确性
function checkIdcard(idcard){
	var Errors=["ok","身份证号码位数不对!","身份证号码出生日期超出范围或含有非法字符!","身份证号码校验错误!","身份证地区非法!"];
	var area={11:"北京",12:"天津",13:"河北",14:"山西",15:"内蒙古",21:"辽宁",22:"吉林",23:"黑龙江",31:"上海",32:"江苏",33:"浙江",34:"安徽",35:"福建",36:"江西",37:"山东",41:"河南",42:"湖北",43:"湖南",44:"广东",45:"广西",46:"海南",50:"重庆",51:"四川",52:"贵州",53:"云南",54:"西藏",61:"陕西",62:"甘肃",63:"青海",64:"宁夏",65:"新疆",71:"台湾",81:"香港",82:"澳门",91:"国外"};
	var idcard,Y,JYM,S,M,idcard_array = [],retflag=false;
	idcard_array = idcard.split("");
	if(area[parseInt(idcard.substr(0,2))]==null)return Errors[4];
		switch(idcard.length){
			case 15:
				return Errors[2];
				break;
			case 18:
				if(parseInt(idcard.substr(6,4)) % 4 == 0 || (parseInt(idcard.substr(6,4))%100 == 0&&parseInt(idcard.substr(6,4))%4 == 0 )){
					ereg=/^[1-9][0-9]{5}[1|2][0|9][0-9]{2}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|[1-2][0-9]))[0-9]{3}[0-9Xx]$/;
				}else{
					ereg=/^[1-9][0-9]{5}[1|2][0|9][0-9]{2}((01|03|05|07|08|10|12)(0[1-9]|[1-2][0-9]|3[0-1])|(04|06|09|11)(0[1-9]|[1-2][0-9]|30)|02(0[1-9]|1[0-9]|2[0-8]))[0-9]{3}[0-9Xx]$/;
				}
				if(ereg.test(idcard)){
					S = (parseInt(idcard_array[0]) + parseInt(idcard_array[10])) * 7 + (parseInt(idcard_array[1]) + parseInt(idcard_array[11])) * 9 + (parseInt(idcard_array[2]) + parseInt(idcard_array[12])) * 10 + (parseInt(idcard_array[3]) + parseInt(idcard_array[13])) * 5 + (parseInt(idcard_array[4]) + parseInt(idcard_array[14])) * 8 + (parseInt(idcard_array[5]) + parseInt(idcard_array[15])) * 4 + (parseInt(idcard_array[6]) + parseInt(idcard_array[16])) * 2 + parseInt(idcard_array[7]) * 1  + parseInt(idcard_array[8]) * 6 + parseInt(idcard_array[9]) * 3 ;
					Y = S % 11;
					M = "F";
					JYM = "10X98765432";
					M = JYM.substr(Y,1);
					if(M == idcard_array[17].toUpperCase())
						return Errors[0]; 
					else
						return Errors[3];
				}
				else
					return Errors[2];
				break;
			default:
				return Errors[1];
				break;
	}
}

//定时关闭提示
function showDialog(text,icon,times){
	
	if(!times){
		times = 1.5;
	}
	
	$.dialog({
		title:"系统提示",
		time:times,
		content:text,
		icon:icon,
		opacity:0.5
	});
}

//蒙层提示
function showSaveDialog(text){
	$.dialog({
		title:"系统提示",
		content:text,
		fixed:true,
		lock:true,
		opacity:0.7,
		drag:false,
		id:"saveDialog",
		esc:false
	});
}
