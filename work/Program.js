var Mackolik = Mackolik || {};

Mackolik.Program = {
    SportType: 'Football',
    Date: '',
    League: '',
    IddaaId: 0,
    TeamName: '',
    Week: '',
    gameType: 7,
    notPlayed: "0",
    sort: '-1',
    lastSort: 0,
    sortDir: 1,
    lastSorted: null,
    changeTab: function (node, obj) {
        aTabEvents[node.order](function () { }, iddaaTab.sBody + node.order);
        iddaaTab.aDataProcessed[node.order] = 1;
        iddaaTab.showPanel(iddaaTab.sBody + node.order);
    },
    getBetsByLeague: function () {
        Mackolik.Program.getComboData();
        var url = APP_ROOT + '/AjaxHandlers/IddaaHandler.aspx?command=tab&type=1&st=' + Mackolik.Program.SportType + "&l=" + Mackolik.Program.League + "&d=" + Mackolik.Program.Date + "&i=" + Mackolik.Program.IddaaId + "&t=" + Mackolik.Program.TeamName + "&ip=1" + "&w=" + Mackolik.Program.Week + "&g=" + Mackolik.Program.gameType + "&np=" + Mackolik.Program.notPlayed + "&srt=" + Mackolik.Program.sort + "&srtd=" + Mackolik.Program.sortDir;
        $.ajax({ url: url, success: Mackolik.Program.getBetsByLeagueResult });
    },
    getBetsByLeagueResult: function (response) {
        $("#iddaa-tab-body1").html(response);
        if (Mackolik.Coupon) Mackolik.Coupon.repaintCouponFace(0);
        Mackolik.Program.organizeSortClicks();
    },
    getBetsByDate: function () {
        Mackolik.Program.getComboData();
        var url = APP_ROOT + '/AjaxHandlers/IddaaHandler.aspx?command=tab&type=2&st=' + Mackolik.Program.SportType + "&l=" + Mackolik.Program.League + "&d=" + Mackolik.Program.Date + "&i=" + Mackolik.Program.IddaaId + "&t=" + Mackolik.Program.TeamName + "&ip=1" + "&w=" + Mackolik.Program.Week + "&g=" + Mackolik.Program.gameType + "&np=" + Mackolik.Program.notPlayed + "&srt=" + Mackolik.Program.sort + "&srtd=" + Mackolik.Program.sortDir;
        $.ajax({ url: url, success: Mackolik.Program.getBetsByDateResult });
    },
    getBetsByDateResult: function (response) {
        $("#iddaa-tab-body2").html(response);
        if (Mackolik.Coupon) Mackolik.Coupon.repaintCouponFace(0);
        Mackolik.Program.organizeSortClicks();
    },
    getMoreBets: function (mac, type, isBasket) {
        if ($("#pinnerdv_" + type + "_" + mac) && $("#pinnerdv_" + type + "_" + mac).length > 0) {
            $("#pinnerdv_" + type + "_" + mac).dialog("open");
            return;
        }
        var urlheader = APP_ROOT;
        if (window.location.href.indexOf("http://user") >= 0) {
            urlheader = USR_APP_ROOT + "../";
        }
        if (isBasket == 1) {
            var url = urlheader + '/AjaxHandlers/IddaaHandler.aspx?command=bbmorebets&mac=' + mac + '&type=' + type;
            $.ajax({ url: url, dataType: 'text', success: function (response) { Mackolik.Program.getMoreBetsResult(mac, type, response); } });
        } else {
            var url = urlheader + '/AjaxHandlers/IddaaHandler.aspx?command=morebets&mac=' + mac + '&type=' + type;
            $.ajax({ url: url, dataType: 'text', success: function (response) { Mackolik.Program.getMoreBetsResult(mac, type, response); } });
        }
    },
    getMoreBetsResult: function (mac, type, response) {
        var pureData = eval("(" + response + ")");
        var data;
        var markets = pureData.Event.Markets;
        var match = pureData.Match;
        //var data = eval("(" + response + ")")[0];
        var mac = mac;
        var type = type;
        var betStr = "<div id='pinnerdv_" + type + "_" + mac + "' style='display:none;'>\
            <div class='modalratedlg modal-bg'>\
              <div class='bet-modal-title-temp'>\
                <div class='bet-modal-date'></div>\
                <div class='clr'></div>\
              </div>\
              <div class='bet-rows'>";
        function pad(num, size) {
            var s = num + "";
            while (s.length < size) s = "0" + s;
            return s;
        }
        for (var i = 0; i < markets.length; i++) {
            var market = markets[i];
            betStr += "<div class='bet-temp'><div class='bet-temp-title-bg'>" + market.Name + " - " + pad(market.MarketNo, 5) + "<span style=\"float:right\"></span></div>\
            <div class='bet-bg'>\
                <table width='100%' border='0' cellspacing='0' cellpadding='0' class='other-ratios'>\
                    <tr class='other-ratios2'>";
            for (var j = 0; j < market.Outcomes.length; j++) {
                betStr += "<td align='center' >" + market.Outcomes[j].OutcomeName.replace("{{SOV}}", market.SOV) + "</td>";
            }
            betStr += "</tr><tr style=\"background-color:#aaa;\">";
            for (var j = 0; j < market.Outcomes.length; j++) {
                betStr += "<td align='center' style=\"color:white !important\">" + pad(j + 1, 2) + "</td>";
            }
            betStr += "</tr><tr>";
            for (var j = 0; j < market.Outcomes.length; j++) {
                betStr += "<td align='center'>" + (market.Outcomes[j].Odd == 1 ? "-" : market.Outcomes[j].Odd.toFixed(2)) + "</td>";
            }
            betStr += "</tr></table></div></div>";
        }
        betStr += "</div></div></div>";

        $('body').append(betStr);

        $("#pinnerdv_" + type + "_" + mac).dialog({ title: match + "&nbsp;MBS: <img src=\"http://im.mackolik.com/img5/iddaa/mbs" + market.MBS + ".png\" valign=\"middle\">", width: 1000, height: 600, autoOpen: true, modal: true, resizable: false });
        //Mackolik.Coupon.repaintCouponFace(0);

    },
    getBBMoreBetsResult: function (response) {
        var data = eval("(" + response + ")")[0];
        var mac = data.MID;
        var type = data.Type;
        var betStr = "<div id='pinnerdv_" + type + "_" + mac + "' style='display:none;'>\
<div class='modal-bg modalratedlg'>\
  <div class='bet-modal-title-temp'>\
    <div class='bet-modal-title'>" + data.ID + " - " + data.T1 + " - " + data.T2 + " <span>(MBS " + data.MB + ")</span></div>\
    <div class='bet-modal-date'></div>\
    <div class='clr'></div>\
  </div>\
  <div class='bet-rows'>\
    <div class='bet-temp' style='width:183px;'>\
      <div class='bet-temp-title-bg'>Maç Sonucu Oranları</div>\
      <div class='bet-bg'>\
        <table width='100%' border='0' cellspacing='0' cellpadding='0' class='other-ratios'>\
          <tr class='other-ratios2'>\
            <td width='50%' align='center'>1</td>\
            <td width='50%' align='center'>2</td>\
          </tr>\
          <tr>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'MS', '1', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'MS', '2', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
          </tr>\
        </table>\
    </div>\
  </div>\
  <div class='bet-temp' style='width:183px;'>\
      <div class='bet-temp-title-bg'>İlk Yarı Oranları</div>\
      <div class='bet-bg'>\
        <table width='100%' border='0' cellspacing='0' cellpadding='0' class='other-ratios'>\
          <tr class='other-ratios2'>\
            <td width='50%' align='center'>1</td>\
            <td width='50%' align='center'>2</td>\
          </tr>\
          <tr>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'IY', '1', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'IY', '2', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
          </tr>\
        </table>\
    </div>\
  </div>\
  <div class='bet-temp' style='width:183px;'>\
      <div class='bet-temp-title-bg'>Alt/Üst Oranları</div>\
      <div class='bet-bg'>\
        <table width='100%' border='0' cellspacing='0' cellpadding='0' class='other-ratios'>\
          <tr class='other-ratios2'>\
            <td width='30%' align='center'>Alt</td>\
            <td width='30%' align='center'>Üst</td>\
            <td width='40%' align='center'>TS</td>\
          </tr>\
          <tr>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'AU', '1', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.IO, 'AU', '2', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + data.TS + "</td>\
          </tr>\
        </table>\
    </div>\
  </div>\
  <div class='clr'></div>\
  </div>\
  <div class='bet-rows'>\
  <div class='bet-temp' style='width:250px;'>\
      <div class='bet-temp-title-bg'>İlk Yarı/Maç Sonucu Oranları</div>\
      <div class='bet-bg'>\
        <table width='100%' border='0' cellspacing='0' cellpadding='0' class='other-ratios'>\
          <tr class='other-ratios2'>\
            <td width='25%' align='center'>1/1</td>\
            <td width='25%' align='center'>1/2</td>\
            <td width='25%' align='center'>2/2</td>\
            <td width='25%' align='center'>2/1</td>\
          </tr>\
          <tr>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.HTFT11, 'IM', '1/1', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.HTFT12, 'IM', '1/2', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.HTFT22, 'IM', '2/2', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
            <td align='center'>" + Mackolik.Coupon.prepareAddCouponLink(data.ID, data.HTFT21, 'IM', '2/1', data.T1, data.T2, mac, data.T1I, data.T2I, data.MB, data.FTH1, data.FTH2, data.HTH1, data.HTH2, data.MD, 'other-rate', 1, data.HT1, data.HT2, data.FT1, data.FT2, data.TS, 0, 0) + "</td>\
          </tr>\
        </table>\
    </div>\
  </div>\
</div>\
</div>";

        $('body').append(betStr);
        $("#pinnerdv_" + type + "_" + mac).dialog({ title: 'IDDAA KODU : ' + data.ID, width: 660, height: 500, autoOpen: true, modal: true, resizable: false });
        Mackolik.Coupon.repaintCouponFace(0);
    },
    getWeekDays: function (week) {
        var url = APP_ROOT + '/AjaxHandlers/IddaaHandler.aspx?command=weekdays&w=' + week;
        $.ajax({ url: url, dataType: 'text', success: Mackolik.Program.getWeekDaysResult });
    },
    getWeekDaysResult: function (response) {
        var data = eval("(" + response + ")");

        var optStr = "";
        $.each(data, function (index, value) {
            optStr += "<option value=" + value.id + ">" + value.g + "</option>";
        });

        $("#IddaaDateCmb").html(optStr);
    },
    getWeekLeagues: function (week, stype, type) {
        // type = all, live
        var url = APP_ROOT + '/AjaxHandlers/IddaaHandler.aspx?command=weekleagues&w=' + week + "&s=" + stype + "&t=" + type;
        $.ajax({ url: url, dataType: 'text', success: Mackolik.Program.getWeekLeaguesResult });
    },
    getWeekLeaguesResult: function (response) {
        var data = eval("(" + response + ")");

        var optStr = "";
        $.each(data, function (index, value) {
            optStr += "<option value=" + value.id + ">" + value.n + "</option>";
        });

        $("#leagueac").html(optStr);
    },
    popDuello: function (duello, type) {
        if ($("#duelbets_" + type + "_" + duello).css("display") != "none") {
            $("#duelinnerdv_" + type + "_" + duello).slideUp('slow', function () { $("#duelbets_" + type + "_" + duello).css('display', "none"); });
            return;
        } else if ($("#duelinnerdv_" + type + "_" + duello).length != 0) {

            $("#duelbets_" + type + "_" + duello).css('display', "");
            $("#duelinnerdv_" + type + "_" + duello).slideDown('slow');
            return;
        }

        var url = APP_ROOT + '/AjaxHandlers/IddaaHandler.aspx?command=duelmatches&d=' + duello + '&type=' + type;
        $.ajax({ url: url, dataType: 'text', success: Mackolik.Program.popDuelloResult });
    },
    popDuelloResult: function (response) {
        var data = eval("(" + response + ")");
        var duello = data.DID;
        var type = data.Type;
        var matches = data.M;

        var retStr = "<td colspan='24' style='height:0px'><div id='duelinnerdv_" + type + "_" + duello + "' style='display:none;width:100%;'><div style='width:100%;' class='slidebckgrnd'></div><table width='100%' border='0' cellspacing='0' cellpadding='0' class='iddaa-oyna-up'>";

        $.each(matches, function (index, row) {
            retStr += "<tr>\
                        <td style=\"width:5;\"><a href=\"javascript:Mackolik.Program.getMoreBets(" + row.MID + ",'" + type + "',0, '')\">" + row.ID + "</a></td>\
                        <td style=\"width:5;\"><a href=\"javascript:popComparison(" + row.MID + ")\"><img src=\"" + IMG_PATH + "/karsilastirma.png\"></a></td>\
                        <td style=\"width:20;\">" + row.TAR.substr(0, 16) + "</td>\
                        <td style=\"width:5;\"><a href=\"javascript:popLeague(" + row.ALTG + ")\"><img src=\"" + GROUP_FLAG_PATH + "/" + row.GRP + ".gif\"></a></td>\
                        <td style=\"width:5;\"><a href=\"javascript:popLeague(" + row.ALTG + ")\">" + row.ALTGA + "</a></td>\
                        <td style=\"width:15;\"><a href=\"javascript:popTeam(" + row.T1I + ")\">" + (row.DTID == row.T1I ? "<b>" : "") + row.T1 + (row.DTID == row.T1I ? "</b>" : "") + "</a></td>\
                        <td style=\"width:5;\"><a href=\"javascript:popMatch(" + row.MID + ")\">" + row.FT1 + "</a></td>\
                        <td style=\"width:5;\"><a href=\"javascript:popMatch(" + row.MID + ")\">v</a></td>\
                        <td style=\"width:5;\"><a href=\"javascript:popMatch(" + row.MID + ")\">" + row.FT2 + "</a></td>\
                        <td style=\"width:15;\"><a href=\"javascript:popTeam(" + row.T2I + ")\">" + (row.DTID == row.T2I ? "<b>" : "") + row.T2 + (row.DTID == row.T2I ? "</b>" : "") + "</a></td>\
                        </tr>";
        });
        retStr += "</table><div style='width:100%;' class='slidebckgrnd'></div></div></td>";

        $("#duelbets_" + type + "_" + duello).html(retStr);
        $("#duelbets_" + type + "_" + duello).css('display', "");
        $("#duelinnerdv_" + type + "_" + duello).slideDown('slow');


    },

    getComboData: function () {
        var url = APP_ROOT + '/AjaxHandlers/ProgramComboHandler.ashx?sport=' + Mackolik.Program.sport + '&type=6' + '&sortValue=DATE' + '&week=' + Mackolik.Program.Week + '&day=' + Mackolik.Program.Date + '&sortDir=1' + '&groupId=' + Mackolik.Program.League + "&np=" + Mackolik.Program.notPlayed;
        $.ajax({ url: url, success: Mackolik.Program.getComboDataCompleted });
    },

    getComboDataCompleted: function (data) {
        data = eval("(" + data + ")");
        //Mackolik.Program.fillCombo(document.getElementById("weekac"), data.w);
        Mackolik.Program.fillCombo(document.getElementById("IddaaDateCmb"), data.d);
        Mackolik.Program.fillCombo(document.getElementById("leagueac"), data.l);
    },

    fillCombo: function (combo, data) {
        var seletedValue;
        combo.innerHTML = "";
        for (var i = 0; i < data.length; i++) {
            var option = document.createElement("option");
            option.value = data[i][0];
            option.innerHTML = data[i][1];
            if (data[i][2] == 1) option.setAttribute("selected", "selected");
            combo.appendChild(option);
        }
    },

    sortClicked: function (oyun, secim) {

        if (oyun == "MS") {
            if (secim == "1") {
                Mackolik.Program.sort = 1;
            } else if (secim == "X") {
                Mackolik.Program.sort = 2;
            } else if (secim == "2") {
                Mackolik.Program.sort = 3;
            }
        }
        else if (oyun == "CS") {
            if (secim == "1X") {
                Mackolik.Program.sort = 4;
            } else if (secim == "12") {
                Mackolik.Program.sort = 5;
            } else if (secim == "X2") {
                Mackolik.Program.sort = 6;
            }
        }
        else if (oyun == "AU") {
            if (secim == "A") {
                Mackolik.Program.sort = 7;
            } else if (secim == "U") {
                Mackolik.Program.sort = 8;
            }
        }
        else if (oyun == "KG") {
            if (secim == "1") {
                Mackolik.Program.sort = 21;
            } else if (secim == "0") {
                Mackolik.Program.sort = 22;
            }
        }
        else if (oyun == "IY") {
            if (secim == "1") {
                Mackolik.Program.sort = 9;
            } else if (secim == "X") {
                Mackolik.Program.sort = 10;
            } else if (secim == "2") {
                Mackolik.Program.sort = 11;
            }
        }
        else if (oyun == "TG") {
            if (secim == "01") {
                Mackolik.Program.sort = 12;
            } else if (secim == "23") {
                Mackolik.Program.sort = 13;
            } else if (secim == "46") {
                Mackolik.Program.sort = 14;
            } else if (secim == "7") {
                Mackolik.Program.sort = 15;
            }
        }
        else if (oyun == "H") {
            if (secim == "1") {
                Mackolik.Program.sort = 18;
            } else if (secim == "X") {
                Mackolik.Program.sort = 19;
            } else if (secim == "2") {
                Mackolik.Program.sort = 20;
            }
        }
        else if (oyun == "IM") {
            if (secim == "XX") {
                Mackolik.Program.sort = 25;
            } else if (secim == "1X") {
                Mackolik.Program.sort = 26;
            } else if (secim == "2X") {
                Mackolik.Program.sort = 27;
            } else if (secim == "X1") {
                Mackolik.Program.sort = 28;
            } else if (secim == "11") {
                Mackolik.Program.sort = 29;
            } else if (secim == "21") {
                Mackolik.Program.sort = 30;
            } else if (secim == "X2") {
                Mackolik.Program.sort = 31;
            } else if (secim == "12") {
                Mackolik.Program.sort = 32;
            } else if (secim == "22") {
                Mackolik.Program.sort = 33;
            }
        }
        else if (oyun == "AU15") {
            if (secim == "1") {
                Mackolik.Program.sort = 34;
            } else if (secim == "2") {
                Mackolik.Program.sort = 35;
            }
        }
        else if (oyun == "AU35") {
            if (secim == "1") {
                Mackolik.Program.sort = 36;
            } else if (secim == "2") {
                Mackolik.Program.sort = 37;
            }
        }
        else if (oyun == "IYAU15") {
            if (secim == "1") {
                Mackolik.Program.sort = 38;
            } else if (secim == "2") {
                Mackolik.Program.sort = 39;
            }
        }
        else if (oyun == "tarih") {
            Mackolik.Program.sort = -1;
        }
        if (Mackolik.Program.lastSort == Mackolik.Program.sort) {
            Mackolik.Program.sortDir = Mackolik.Program.sortDir == 1 ? 2 : 1;
        } else {
            Mackolik.Program.sortDir = 1;
            Mackolik.Program.lastSort = Mackolik.Program.sort;
        }
        iddaaTab.aDataProcessed[1] = 0;
        iddaaTab.aDataProcessed[2] = 0;
        $("#tab-list .active").trigger('click');
    },
    organizeSortClicks: function () {
        var firstAttr = "";

        $("#iddaa-tab-body .current").removeClass("sorted1").removeClass("sorted2");

        $("#iddaa-tab-body .current .sortratecls").each(function (index, value) {
            if (firstAttr == "") { firstAttr = $(value).attr("ratesort"); }
            else { if (firstAttr == $(value).attr("ratesort")) { return false; } }

            if (Mackolik.Program.lastSorted != null && $(value).attr("ratesort") == Mackolik.Program.lastSorted) {
                $(value).addClass("sorted" + Mackolik.Program.sortDir);
                $(value).append("<img src='" + IMG_PATH + "/icons/table-arrow_" + (Mackolik.Program.sortDir == 1 ? "up" : "down") + ".png'>");
            }
            $(value).css("cursor", "pointer");
            $(value).click(function () {
                var sortStr = $(this).attr("ratesort").split("_");
                var oyun = sortStr[0];
                var secim = sortStr[1];
                Mackolik.Program.lastSorted = $(this).attr("ratesort");
                Mackolik.Program.sortClicked(oyun, secim);
            });
        });

    }

}

