var Mackolik = Mackolik || {};
Mackolik.Program = Mackolik.Program || {};
Mackolik.Program.Large = Mackolik.Program.Large || {};

Mackolik.Program.Large = {
    getGroupProgram: function () {
        this.writeLoading();
        var url = APP_ROOT + '/AjaxHandlers/ProgramDataHandler.ashx?type=' + Mackolik.Program.type + '&sortValue=' + Mackolik.Program.sortValue + '&day=' + Mackolik.Program.day + '&sort=' + Mackolik.Program.sort + '&sortDir=' + Mackolik.Program.sortDir + '&groupId=' + Mackolik.Program.groupId + "&np=" + Mackolik.Program.notPlayed + '&sport=' + Mackolik.Program.sport;
        if (Mackolik.Program.sport == 1) {
            $.ajax({ url: url, success: Mackolik.Program.Large.getProgramCompleted });
        } else {
            $.ajax({ url: url, success: Mackolik.Program.Large.getBasketballProgramCompleted });
        }
    },
    writeLoading: function () {
        document.getElementById('dvLarge').innerHTML = "<div class='loading_div'><h3>Yükleniyor</h3><img src='" + ICON_PATH + "loading.gif' alt=''></div>";
    },
    getProgram: function () {
        Mackolik.Program.Large.getComboData();
        this.getGroupProgram();
    },
    getProgramCompleted: function (data) {
        //try {
        Mackolik.Program.Largedata = eval("(" + data + ")");
        if (Mackolik.Program.sortValue == "ALTG_ADI10")
            Mackolik.Program.Large.writeProgramByGroup(Mackolik.Program.Largedata);
        else if (Mackolik.Program.sortValue == "DATE")
            Mackolik.Program.Large.writeProgramByDate(Mackolik.Program.Largedata);
        //}
        //catch (err) {
        //alert(err);
        //}
    },
    getBasketballProgramCompleted: function (data) {
        try {
            Mackolik.Program.Largedata = eval("(" + data + ")");
            if (Mackolik.Program.sortValue == "ALTG_ADI10")
                Mackolik.Program.Large.writeBasketballProgramByGroup(Mackolik.Program.Largedata);
            else if (Mackolik.Program.sortValue == "DATE")
                Mackolik.Program.Large.writeBasketballProgramByDate(Mackolik.Program.Largedata);
        }
        catch (err) {
            alert(err);
        }
    },


    writeProgramByDate: function (livedata) {

        /*    
        var dateFormat = dateFormat + '<tr class="groupHeader dateHeader" height=15><td width="45" style="text-align:left"><b>Saat{11}</b></td><td width="40" style="text-align:left"><b>Lig{12}</b></td><td width="19"><b>&nbsp;</b></td><td width="30" style="text-align:left"><b>Kod</b></td><td width="30"><b>MBS</b></td><td width="70" style="text-align:left"><b>Ev Sahibi</b></td><td width="70" style="text-align:left"><b>Misafir</b></td><td align="center" width="35"><b>IY</b></td> <td align="center" width="35"><b>MS</b></td> <td align="center" style="width: 35px;">{0}</td><td align="center" style="width: 35px;"><b>{1}</b></td><td align="center" style="width: 35px;">{2}</td><td align="center" style="width: 35px;">{3}</td><td align="center" style="width: 35px;"><b>{4}</b></td><td align="center" style="width: 35px;">{5}</td><td width="18"><b>h</b></td><td align="center" style="width: 35px;">{17}</td><td align="center" style="width: 35px;"><b>{18}</b></td><td align="center" style="width: 35px;">{19}</td><td width="15"><b>h</b></td><td align="center" style="width: 40px;">{6}</td><td align="center" style="width: 40px;">{7}</td><td align="center" style="width: 40px;"><b>{8}</b></td><td align="center" style="width: 35px;">{9}</td><td align="center" style="width: 35px;">{10}</td><td align="center" style="width: 45px;">{13}</td><td align="center" style="width: 45px;">{14}</td><td align="center" style="width: 45px;">{15}</td><td align="center" style="width: 35px;">{16}</td><td align="center" style="border-bottom:none" width="25"/></tr>';
        var dateFormat2 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td><td colspan="33"></td></tr>';
        var dateFormat3 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td><td></td><td style="text-align:left">Kod</td><td style="text-align:left">MBS</td><td style="text-align:left">Ev Sahibi</td><td style="text-align:left">Misafir</td><td style="text-align:center">IY</td><td style="text-align:center">MS</td><td style="text-align:center">1</td><td style="text-align:center">X</td><td style="text-align:center">2</td><td style="text-align:center">1</td><td style="text-align:center">X</td><td style="text-align:center">2</td><td style="text-align:left">h</td><td style="text-align:center">H1</td><td style="text-align:center">HX</td><td style="text-align:center">H2</td><td style="text-align:left">h</td><td style="text-align:center">1/X</td><td style="text-align:center">1/2</td><td style="text-align:center">X/2</td><td style="text-align:center">A</td><td style="text-align:center">Ü</td><td style="text-align:center">0-1</td><td style="text-align:center">2-3</td><td style="text-align:center">4-6</td><td style="text-align:center">7+</td></tr>';
        */

        var dateFormat = '<tr class="groupHeader" height=15><td colspan=9></td>\
                                                            <td colspan=3 align="center" style="background-color:#59a113;color:#FFFFFF;font-weight:bold;font-size:10px">Maç Sonucu</td>\
                                                            <td colspan=3 align="center" style="background-color:#2EB8BE;color:#FFFFFF;font-weight:bold;font-size:10px">İlk Yarı Sonucu</td>\
                                                            <td colspan=5 align="center" style="background-color:#8E8E8E;color:#FFFFFF;font-weight:bold;font-size:10px">Handikap Maç Sonucu</td>\
                                                            <td colspan=2 align="center" style="background-color:#444444;color:#FFFFFF;font-weight:bold;font-size:10px">Karşılıklı Gol</td>\
                                                            <td colspan=3 align="center" style="background-color:#be0000;color:#FFFFFF;font-weight:bold;font-size:10px">Çifte Şans</td>\
                                                            <td colspan=2 align="center" style="background-color:#971463;color:#FFFFFF;font-weight:bold;font-size:10px">IY 1,5 Gol</td>\
                                                            <td colspan=2 align="center" style="background-color:#971463;color:#FFFFFF;font-weight:bold;font-size:10px">AÜ 1,5 Gol</td>\
                                                            <td colspan=2 align="center" style="background-color:#971463;color:#FFFFFF;font-weight:bold;font-size:10px">AÜ 2,5 Gol</td>\
                                                            <td colspan=2 align="center" style="background-color:#971463;color:#FFFFFF;font-weight:bold;font-size:10px">AÜ 3,5 Gol</td>\
                                                            <td colspan=4 align="center" style="background-color:#9E991B;color:#FFFFFF;font-weight:bold;font-size:10px">Toplam Gol</td>\
                                                            <td></td></tr>';

        var dateFormat = dateFormat + '<tr class="groupHeader dateHeader" height=15>\
                                       <td width="45" style="text-align:left"><b>Saat{11}</b></td>\
                                       <td width="40" style="text-align:left"><b>Lig{12}</b></td>\
                                       <td width="19"><b>&nbsp;</b></td>\
                                       <td width="30" style="text-align:left"><b>Kod</b></td>\
                                       <td width="30"><b>MBS</b></td>\
                                       <td width="70" style="text-align:left"><b>Ev Sahibi</b></td>\
                                       <td width="70" style="text-align:left"><b>Misafir</b></td>\
                                       <td align="center" width="35"><b>IY</b></td>\
                                       <td align="center" width="35"><b>MS</b></td>\
                                       <td align="center" style="width: 35px;">{0}</td>\
                                       <td align="center" style="width: 35px;"><b>{1}</b></td>\
                                       <td align="center" style="width: 35px;">{2}</td>\
                                       <td align="center" style="width: 35px;">{3}</td>\
                                       <td align="center" style="width: 35px;"><b>{4}</b></td>\
                                       <td align="center" style="width: 35px;">{5}</td>\
                                       <td width="18"><b>h</b></td>\
                                       <td align="center" style="width: 35px;">{17}</td>\
                                       <td align="center" style="width: 35px;"><b>{18}</b></td>\
                                       <td align="center" style="width: 35px;">{19}</td>\
                                       <td width="15"><b>h</b></td>\
                                       <td align="center" style="width: 35px;">{20}</td>\
                                       <td align="center" style="width: 35px;">{21}</td>\
                                       <td align="center" style="width: 40px;">{6}</td>\
                                       <td align="center" style="width: 40px;">{7}</td>\
                                       <td align="center" style="width: 40px;"><b>{8}</b></td>\
                                       <td align="center" style="width: 35px;">{22}</td>\
                                       <td align="center" style="width: 35px;">{23}</td>\
                                       <td align="center" style="width: 35px;">{24}</td>\
                                       <td align="center" style="width: 35px;">{25}</td>\
                                       <td align="center" style="width: 35px;">{9}</td>\
                                       <td align="center" style="width: 35px;">{10}</td>\
                                       <td align="center" style="width: 35px;">{26}</td>\
                                       <td align="center" style="width: 35px;">{27}</td>\
                                       <td align="center" style="width: 45px;">{13}</td>\
                                       <td align="center" style="width: 45px;">{14}</td>\
                                       <td align="center" style="width: 45px;">{15}</td>\
                                       <td align="center" style="width: 35px;">{16}</td>\
                                       <td align="center" style="border-bottom:none" width="25"/>\
                                       </tr>';

        var dateFormat2 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td><td colspan="43"></td></tr>';
        var dateFormat3 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td>\
                                                                        <td></td>\
                                                                        <td style="text-align:left">Kod</td>\
                                                                        <td style="text-align:left">MBS</td>\
                                                                        <td style="text-align:left">Ev Sahibi</td>\
                                                                        <td style="text-align:left">Misafir</td>\
                                                                        <td style="text-align:center">IY</td>\
                                                                        <td style="text-align:center">MS</td>\
                                                                        <td style="text-align:center">1</td>\
                                                                        <td style="text-align:center">X</td>\
                                                                        <td style="text-align:center">2</td>\
                                                                        <td style="text-align:center">1</td>\
                                                                        <td style="text-align:center">X</td>\
                                                                        <td style="text-align:center">2</td>\
                                                                        <td style="text-align:left">h</td>\
                                                                        <td style="text-align:center">H1</td>\
                                                                        <td style="text-align:center">HX</td>\
                                                                        <td style="text-align:center">H2</td>\
                                                                        <td style="text-align:left">h</td>\
                                                                        <td style="text-align:center">Var</td>\
                                                                        <td style="text-align:center">Yok</td>\
                                                                        <td style="text-align:center">1/X</td>\
                                                                        <td style="text-align:center">1/2</td>\
                                                                        <td style="text-align:center">X/2</td>\
                                                                        <td style="text-align:center">A</td>\
                                                                        <td style="text-align:center">Ü</td>\
                                                                        <td style="text-align:center">A</td>\
                                                                        <td style="text-align:center">Ü</td>\
                                                                        <td style="text-align:center">A</td>\
                                                                        <td style="text-align:center">Ü</td>\
                                                                        <td style="text-align:center">A</td>\
                                                                        <td style="text-align:center">Ü</td>\
                                                                        <td style="text-align:center">0-1</td>\
                                                                        <td style="text-align:center">2-3</td>\
                                                                        <td style="text-align:center">4-6</td>\
                                                                        <td style="text-align:center">7+</td></tr>';

        var sort = Mackolik.Program.sort;
        var bSort = (sort != 1 && sort != 2 && sort != 3);
        var sortSpan1 = bSort ? '<span style="color:#000066"><b>1</b></span>' : '<span><b>1</b></span>';
        var sortSpanX = bSort ? '<span style="color:#000066"><b>X</b></span>' : '<span><b>X</b></span>';
        var sortSpan2 = bSort ? '<span style="color:#000066"><b>2</b></span>' : '<span><b>2</b></span>';

        var sortSpanIY1 = bSort ? '<span style="color:#000066"><b>1</b></span>' : '<span><b>1</b></span>';
        var sortSpanIYX = bSort ? '<span style="color:#000066"><b>X</b></span>' : '<span><b>X</b></span>';
        var sortSpanIY2 = bSort ? '<span style="color:#000066"><b>2</b></span>' : '<span><b>2</b></span>';

        var sortSpan1X = bSort ? '<span style="color:#000066"><b>1/X</b></span>' : '<span><b>1/X</b></span>';
        var sortSpan12 = bSort ? '<span style="color:#000066"><b>1/2</b></span>' : '<span><b>1/2</b></span>';
        var sortSpanX2 = bSort ? '<span style="color:#000066"><b>X/2</b></span>' : '<span><b>X/2</b></span>';
        var sortSpanA = bSort ? '<span style="color:#000066"><b>A</b></span>' : '<span><b>A</b></span>';
        var sortSpanU = bSort ? '<span style="color:#000066"><b>U</b></span>' : '<span><b>U</b></span>';

        var sortSpanAIY15 = bSort ? '<span style="color:#000066"><b>A</b></span>' : '<span><b>A</b></span>';
        var sortSpanUIY15 = bSort ? '<span style="color:#000066"><b>U</b></span>' : '<span><b>U</b></span>';
        var sortSpanA15 = bSort ? '<span style="color:#000066"><b>A</b></span>' : '<span><b>A</b></span>';
        var sortSpanU15 = bSort ? '<span style="color:#000066"><b>U</b></span>' : '<span><b>U</b></span>';
        var sortSpanA35 = bSort ? '<span style="color:#000066"><b>A</b></span>' : '<span><b>A</b></span>';
        var sortSpanU35 = bSort ? '<span style="color:#000066"><b>U</b></span>' : '<span><b>U</b></span>';

        var sortSpanKGVar = bSort ? '<span style="color:#000066"><b>Var</b></span>' : '<span><b>Var</b></span>';
        var sortSpanKGYok = bSort ? '<span style="color:#000066"><b>Yok</b></span>' : '<span><b>Yok</b></span>';
        var sortSpanG01 = bSort ? '<span style="color:#000066"><b>0-1</b></span>' : '<span><b>0-1</b></span>';
        var sortSpanG23 = bSort ? '<span style="color:#000066"><b>2-3</b></span>' : '<span><b>2-3</b></span>';
        var sortSpanG46 = bSort ? '<span style="color:#000066"><b>4-6</b></span>' : '<span><b>4-6</b></span>';
        var sortSpanG7 = bSort ? '<span style="color:#000066"><b>7+</b></span>' : '<span><b>7+</b></span>';

        var sortSpanH1 = bSort ? '<span style="color:#000066"><b>H1</b></span>' : '<span><b>H1</b></span>';
        var sortSpanHX = bSort ? '<span style="color:#000066"><b>HX</b></span>' : '<span><b>HX</b></span>';
        var sortSpanH2 = bSort ? '<span style="color:#000066"><b>H2</b></span>' : '<span><b>H2</b></span>';

        var sortSpanS = '', sortSpanL = '';

        sortSpan1 = Mackolik.Program.sort == 1 && Mackolik.Program.sortDir == 1 ? sortSpan1 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan1 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(1,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan1 = Mackolik.Program.sort == 1 && Mackolik.Program.sortDir == 2 ? sortSpan1 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan1 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(1,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanX = Mackolik.Program.sort == 2 && Mackolik.Program.sortDir == 1 ? sortSpanX + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanX + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(2,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanX = Mackolik.Program.sort == 2 && Mackolik.Program.sortDir == 2 ? sortSpanX + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanX + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(2,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpan2 = Mackolik.Program.sort == 3 && Mackolik.Program.sortDir == 1 ? sortSpan2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(3,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan2 = Mackolik.Program.sort == 3 && Mackolik.Program.sortDir == 2 ? sortSpan2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(3,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanH1 = Mackolik.Program.sort == 18 && Mackolik.Program.sortDir == 1 ? sortSpanH1 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanH1 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(18,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanH1 = Mackolik.Program.sort == 18 && Mackolik.Program.sortDir == 2 ? sortSpanH1 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanH1 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(18,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanHX = Mackolik.Program.sort == 19 && Mackolik.Program.sortDir == 1 ? sortSpanHX + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanHX + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(19,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanHX = Mackolik.Program.sort == 19 && Mackolik.Program.sortDir == 2 ? sortSpanHX + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanHX + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(19,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanH2 = Mackolik.Program.sort == 20 && Mackolik.Program.sortDir == 1 ? sortSpanH2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanH2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(20,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanH2 = Mackolik.Program.sort == 20 && Mackolik.Program.sortDir == 2 ? sortSpanH2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanH2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(20,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanIY1 = Mackolik.Program.sort == 9 && Mackolik.Program.sortDir == 1 ? sortSpanIY1 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIY1 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(9,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIY1 = Mackolik.Program.sort == 9 && Mackolik.Program.sortDir == 2 ? sortSpanIY1 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIY1 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(9,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIYX = Mackolik.Program.sort == 10 && Mackolik.Program.sortDir == 1 ? sortSpanIYX + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIYX + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(10,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIYX = Mackolik.Program.sort == 10 && Mackolik.Program.sortDir == 2 ? sortSpanIYX + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIYX + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(10,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIY2 = Mackolik.Program.sort == 11 && Mackolik.Program.sortDir == 1 ? sortSpanIY2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIY2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(11,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIY2 = Mackolik.Program.sort == 11 && Mackolik.Program.sortDir == 2 ? sortSpanIY2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIY2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(11,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpan1X = Mackolik.Program.sort == 4 && Mackolik.Program.sortDir == 1 ? sortSpan1X + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan1X + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(4,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan1X = Mackolik.Program.sort == 4 && Mackolik.Program.sortDir == 2 ? sortSpan1X + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan1X + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(4,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpan12 = Mackolik.Program.sort == 5 && Mackolik.Program.sortDir == 1 ? sortSpan12 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan12 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(5,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan12 = Mackolik.Program.sort == 5 && Mackolik.Program.sortDir == 2 ? sortSpan12 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan12 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(5,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanX2 = Mackolik.Program.sort == 6 && Mackolik.Program.sortDir == 1 ? sortSpanX2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanX2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(6,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanX2 = Mackolik.Program.sort == 6 && Mackolik.Program.sortDir == 2 ? sortSpanX2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanX2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(6,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanA = Mackolik.Program.sort == 7 && Mackolik.Program.sortDir == 1 ? sortSpanA + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanA + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(7,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanA = Mackolik.Program.sort == 7 && Mackolik.Program.sortDir == 2 ? sortSpanA + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanA + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(7,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanU = Mackolik.Program.sort == 8 && Mackolik.Program.sortDir == 1 ? sortSpanU + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanU + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(8,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanU = Mackolik.Program.sort == 8 && Mackolik.Program.sortDir == 2 ? sortSpanU + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanU + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(8,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanAIY15 = Mackolik.Program.sort == 38 && Mackolik.Program.sortDir == 1 ? sortSpanAIY15 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanAIY15 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(38,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanAIY15 = Mackolik.Program.sort == 38 && Mackolik.Program.sortDir == 2 ? sortSpanAIY15 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanAIY15 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(38,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanUIY15 = Mackolik.Program.sort == 39 && Mackolik.Program.sortDir == 1 ? sortSpanUIY15 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanUIY15 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(39,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanUIY15 = Mackolik.Program.sort == 39 && Mackolik.Program.sortDir == 2 ? sortSpanUIY15 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanUIY15 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(39,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanA15 = Mackolik.Program.sort == 34 && Mackolik.Program.sortDir == 1 ? sortSpanA15 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanA15 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(34,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanA15 = Mackolik.Program.sort == 34 && Mackolik.Program.sortDir == 2 ? sortSpanA15 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanA15 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(34,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanU15 = Mackolik.Program.sort == 35 && Mackolik.Program.sortDir == 1 ? sortSpanU15 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanU15 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(35,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanU15 = Mackolik.Program.sort == 35 && Mackolik.Program.sortDir == 2 ? sortSpanU15 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanU15 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(35,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanA35 = Mackolik.Program.sort == 36 && Mackolik.Program.sortDir == 1 ? sortSpanA35 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanA35 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(36,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanA35 = Mackolik.Program.sort == 36 && Mackolik.Program.sortDir == 2 ? sortSpanA35 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanA35 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(36,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanU35 = Mackolik.Program.sort == 37 && Mackolik.Program.sortDir == 1 ? sortSpanU35 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanU35 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(37,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanU35 = Mackolik.Program.sort == 37 && Mackolik.Program.sortDir == 2 ? sortSpanU35 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanU35 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(37,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanKGVar = Mackolik.Program.sort == 21 && Mackolik.Program.sortDir == 1 ? sortSpanKGVar + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanKGVar + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(21,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanKGVar = Mackolik.Program.sort == 21 && Mackolik.Program.sortDir == 2 ? sortSpanKGVar + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanKGVar + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(21,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanKGYok = Mackolik.Program.sort == 22 && Mackolik.Program.sortDir == 1 ? sortSpanKGYok + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanKGYok + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(22,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanKGYok = Mackolik.Program.sort == 22 && Mackolik.Program.sortDir == 2 ? sortSpanKGYok + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanKGYok + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(22,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanS = Mackolik.Program.sort == 24 && Mackolik.Program.sortDir == 1 ? sortSpanS + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanS + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(24,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanS = Mackolik.Program.sort == 24 && Mackolik.Program.sortDir == 2 ? sortSpanS + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanS + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(24,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanL = Mackolik.Program.sort == 23 && Mackolik.Program.sortDir == 1 ? sortSpanL + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanL + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(23,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanL = Mackolik.Program.sort == 23 && Mackolik.Program.sortDir == 2 ? sortSpanL + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanL + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(23,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanG01 = Mackolik.Program.sort == 12 && Mackolik.Program.sortDir == 1 ? sortSpanG01 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanG01 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(12,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanG01 = Mackolik.Program.sort == 12 && Mackolik.Program.sortDir == 2 ? sortSpanG01 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanG01 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(12,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanG23 = Mackolik.Program.sort == 13 && Mackolik.Program.sortDir == 1 ? sortSpanG23 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanG23 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(13,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanG23 = Mackolik.Program.sort == 13 && Mackolik.Program.sortDir == 2 ? sortSpanG23 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanG23 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(13,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanG46 = Mackolik.Program.sort == 14 && Mackolik.Program.sortDir == 1 ? sortSpanG46 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanG46 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(14,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanG46 = Mackolik.Program.sort == 14 && Mackolik.Program.sortDir == 2 ? sortSpanG46 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanG46 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(14,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanG7 = Mackolik.Program.sort == 15 && Mackolik.Program.sortDir == 1 ? sortSpanG7 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanG7 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(15,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanG7 = Mackolik.Program.sort == 15 && Mackolik.Program.sortDir == 2 ? sortSpanG7 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanG7 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(15,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        var rowFormat = '<tr onmouseover="HLon(this)" onmouseout="HLoff(this)" class="{0}"><td>{1}</td>';

        rowFormat = rowFormat + '<td align="left" style="padding:0px;border-right:none;">&nbsp;<a href="javascript:{29}==99999?popDuelloDialog({2}):popLeague({30})">{28}</a></td>'
        rowFormat = rowFormat + '<td><a href="javascript:{29}==99999?popDuelloDialog({2}):popLeague({30})"><img src="' + GROUP_FLAG_PATH + '/{29}.gif"/></a></td>';
        rowFormat = rowFormat + '<td><a href="javascript:{29}==99999?popDuelloDialog({2}):popComparison({2})"><b>{3}</b></a></td>';
        rowFormat = rowFormat + '<td align=center> {4} &nbsp;</td>'
        rowFormat = rowFormat + '<td align=left>{6}<a href="javascript:{29}==99999?popDuelloDialog({2}):popTeam({7})">{8}</a>{9}</td>';
        rowFormat = rowFormat + '<td style="border-right:none" align=left>{10}<a href="javascript:{29}==99999?popDuelloDialog({2}):popTeam({11})">{12}</a> {13} </td>';
        rowFormat = rowFormat + '<td align=center>{14}</td><td align=center>{15} </td>';
        rowFormat = rowFormat + '{23}{24}{25}{31}{32}{33}{21}{38}{39}{40}{22}{41}{42}{16}{17}{18}{43}{44}{45}{46}{19}{20}{47}{48}{34}{35}{36}{37}';
        rowFormat = rowFormat + '<td align=center>{27}</td></tr>';

        var header = '<table style="width:100%;" border=0 cellpadding=0 cellspacing=0  id=resultsList style="border: 1px solid rgb(204, 204, 204);" class="iddaa-oyna-table"><tr height="1" class="groupHeader dateHeader">\
                                                                                                                                                                                <td colspan="9"/><td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="3"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="3"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="5"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="2"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="3"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="2"/><td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="2"/><td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="2"/><td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="2"/><td width="1" rowspan="5000"></td>\
                                                                                                                                                                                <td colspan="4"/> <td width="1" rowspan="5000"></td>\
                                                                                                                                                                                </tr>';

        var sbScores = new StringBuilder();
        var dateData = livedata.m;

        sbScores.append(header);

        var k = 0;
        for (var j = 0; j < dateData.length; j++) {

            if (j == 0)                             // 0         1        2            3            4              5           6           7          8           9          10        11         12           13           14         15           16           17        18            19             20          21               22             23          24            25          26            27                    
                sbScores.appendFormat(dateFormat, sortSpan1, sortSpanX, sortSpan2, sortSpanIY1, sortSpanIYX, sortSpanIY2, sortSpan1X, sortSpan12, sortSpanX2, sortSpanA, sortSpanU, sortSpanS, sortSpanL, sortSpanG01, sortSpanG23, sortSpanG46, sortSpanG7, sortSpanH1, sortSpanHX, sortSpanH2, sortSpanKGVar, sortSpanKGYok, sortSpanAIY15, sortSpanUIY15, sortSpanA15, sortSpanU15, sortSpanA35, sortSpanU35);

            if (j == 0)
                sbScores.appendFormat(dateFormat2, dateData[j].d);
            else
                sbScores.appendFormat(dateFormat3, dateData[j].d);

            var data = dateData[j].m;

            if (data.length == 0)
                sbScores.append('<tr><td bgcolor=#CED7D2></td><td colspan=26 bgcolor=#CED7D2><b>Bu kriterlere uygun maç bulunamadi.</b></td></tr>');

            var weekStatus = true;
            if (Mackolik.Program.week != Mackolik.Program.currentWeek) {
                weekStatus = false;
            }

            for (var i = 0; i < data.length; i++, k++) {
                var matchData = data[i];
                var score = '';
                var match_status = '';
                var stadium_status = '&nbsp;';
                var matchDetail = matchData[25];
                var classname = (k % 2) == 1 ? "alt1" : "alt2";
                var saat = matchData[6];
                var match_id = matchData[0];
                var iddaId = matchData[10];
                var altgeleme = matchData[48];
                var sezonid = matchData[49];

                //var imo_minmatch = matchData[13] == undefined ? "" : matchData[13];
                var imo_minmatchint = matchData[13] ? matchData[13] : "4";
                var imo_minmatch = "<img src='" + ICON_PATH + "mbs" + imo_minmatchint + ".gif'>";

                var flag1 = "&nbsp;"
                var flag2 = "&nbsp;"
                if (matchDetail.bh) {
                    flag1 = "<img src='" + SMALL_FLAG_PATH + matchDetail.bh + ".gif' title='" + matchDetail.bhn + "'>";
                }
                if (matchDetail.ba) {
                    flag2 = "<img src='" + SMALL_FLAG_PATH + matchDetail.ba + ".gif' title='" + matchDetail.ban + "'>";
                }
                var macSonuc1 = matchData[8];
                var macSonuc2 = matchData[9];
                var IYSonuc1 = matchData[11] != undefined ? matchData[11] : "";
                var IYSonuc2 = matchData[12] != undefined ? matchData[12] : "";
                var macDurum = matchData[5];
                var takim1 = matchData[1];
                var takim1Id = matchData[2];
                var takim2 = matchData[3];
                var takim2Id = matchData[4];
                var imo_handikap1 = matchData[14] == undefined ? '' : matchData[14];
                var imo_handikap2 = matchData[15] == undefined ? '' : matchData[15];

                var bold1 = (macSonuc1 > macSonuc2) && macDurum >= 4 ? "<b>" : "";
                var bold2 = (macSonuc1 > macSonuc2) && macDurum >= 4 ? "</b>" : "";

                var bold3 = (macSonuc1 < macSonuc2) && macDurum >= 4 ? "<b>" : "";
                var bold4 = (macSonuc1 < macSonuc2) && macDurum >= 4 ? "</b>" : "";

                var htsonuc;
                if (macDurum == 9) {
                    htsonuc = 'ERT';
                } else if (macDurum == 11) {
                    htsonuc = 'Yrdk.';
                } else {
                    htsonuc = macDurum >= 2 ? IYSonuc1 + ' - ' + IYSonuc2 : '&nbsp;';
                }

                var ms;

                if (macDurum < 4) {
                    ms = '<a href=\"javascript:' + matchData[27] + '==99999?popDuelloDialog(' + match_id + '):popMatch(' + match_id + ')\">v</a>';
                } else {
                    if (macDurum == 9) {
                        ms = '<b><a href=\"javascript:' + matchData[27] + '==99999?popDuelloDialog(' + match_id + '):popMatch(' + match_id + ')\">ERT.</a></b>';
                    } else if (macDurum == 11) {
                        ms = '<b><a href=\"javascript:' + matchData[27] + '==99999?popDuelloDialog(' + match_id + '):popMatch(' + match_id + ')\">Yrdk.</a></b>';
                    } else {
                        ms = '<b><a href=\"javascript:' + matchData[27] + '==99999?popDuelloDialog(' + match_id + '):popMatch(' + match_id + ')\">' + macSonuc1 + ' - ' + macSonuc2 + '</a></b>';
                    }
                }

                var imo_ms1 = matchData[16];
                var imo_ms0 = matchData[17];
                var imo_ms2 = matchData[18];
                var imo_ms1str, imo_ms2str, imo_ms3str;

                var imo_hms1 = matchData[36];
                var imo_hms0 = matchData[37];
                var imo_hms2 = matchData[38];
                var imo_hms1str, imo_hms2str, imo_hms3str;

                var imo_ms1cls = "";
                var imo_ms0cls = "";
                var imo_ms2cls = "";

                var imo_hms1cls = "";
                var imo_hms0cls = "";
                var imo_hms2cls = "";

                var imo_kg_var = matchData[39];
                var imo_kg_yok = matchData[40];

                var imo_kg_varstr, imo_kg_yokstr;
                var imo_kg_varcls = "";
                var imo_kg_yokcls = "";

                var isHandicaped = "0";
                if (imo_hms1 == '-' && imo_handikap1 != '') {
                    takim1 = takim1 + "<span style='color:red'>(H:" + imo_handikap1 + ")</span>";
                    isHandicaped = "1";
                }

                if (imo_hms1 == '-' && imo_handikap2 != '') {
                    takim2 = takim2 + "<span style='color:red'>(H:" + imo_handikap2 + ")</span>";
                    isHandicaped = "1";
                }
                if (imo_hms1 == '-' && (imo_handikap1 != '' || imo_handikap2 != '')) {
                    imo_ms1cls = imo_hms1cls;
                    imo_ms0cls = imo_hms0cls;
                    imo_ms2cls = imo_hms2cls;
                }
                var eventId = matchData[50];
                var duelloId = matchData[41];

                if (imo_ms1 != "-")
                    imo_ms1str = '<td align=center style="padding-right:2px;" class=\"' + imo_ms1cls + '\">' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Maç Sonucu', "['1','X','2']", "['" + imo_ms1 + "','" + imo_ms0 + "','" + imo_ms2 + "']",eventId, matchData[51], "['1','2','3']", imo_ms1) + '</td>';
                else
                    imo_ms1str = '<td align=center>-</td>';

                if (imo_ms0 != "-")
                    imo_ms0str = '<td align=center style="padding-right:2px;" class=\"' + imo_ms0cls + '\">' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Maç Sonucu', "['1','X','2']", "['" + imo_ms1 + "','" + imo_ms0 + "','" + imo_ms2 + "']",eventId, matchData[51], "['1','2','3']", imo_ms0) + '</td>';
                else
                    imo_ms0str = '<td align=center>-</td>';

                if (imo_ms2 != "-")
                    imo_ms2str = '<td align=center style="padding-right:2px;" class=\"' + imo_ms2cls + '\">' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Maç Sonucu', "['1','X','2']", "['" + imo_ms1 + "','" + imo_ms0 + "','" + imo_ms2 + "']",eventId, matchData[51], "['1','2','3']", imo_ms2) + '</td>';
                else
                    imo_ms2str = '<td align=center>-</td>';

                if (imo_hms1 != "-")
                    imo_hms1str = '<td align=center style="padding-right:2px;" class=\"' + imo_hms1cls + '\">-</td>';
                else
                    imo_hms1str = '<td align=center>-</td>';

                if (imo_hms0 != "-")
                    imo_hms0str = '<td align=center style="padding-right:2px;" class=\"' + imo_hms0cls + '\">-</td>';
                else
                    imo_hms0str = '<td align=center>-</td>';

                if (imo_hms2 != "-")
                    imo_hms2str = '<td align=center style="padding-right:2px;" class=\"' + imo_hms2cls + '\">-</td>';
                else
                    imo_hms2str = '<td align=center>-</td>';

                if (imo_kg_var != "0")
                    imo_kg_varstr = '<td align=center style="padding-right:2px;" class=\"' + imo_kg_varcls + '\">' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Karşılıklı Gol', "['Var','Yok']", "['" + imo_kg_var + "','" + imo_kg_yok + "']",eventId, matchData[56], "['1','2']", imo_kg_var) + '</td>';
                else
                    imo_kg_varstr = '<td align=center>-</td>';

                if (imo_kg_yok != "0")
                    imo_kg_yokstr = '<td align=center style="padding-right:2px;" class=\"' + imo_kg_yokcls + '\">' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Karşılıklı Gol', "['Var','Yok']", "['" + imo_kg_var + "','" + imo_kg_yok + "']",eventId, matchData[56], "['1','2']", imo_kg_yok) + '</td>';
                else
                    imo_kg_yokstr = '<td align=center>-</td>';

                var imo_cs10 = matchData[19];
                var imo_cs12 = matchData[20];
                var imo_cs02 = matchData[21];
                var imo_cs10str, imo_cs12str, imo_cs02str;
                var h2 = 0, h1 = 0;
                if (imo_hms1 == '-' && (imo_handikap1 != '' || imo_handikap2 != '')) {
                    h1 = imo_handikap1 == '' ? 0 : imo_handikap1;
                    h2 = imo_handikap2 == '' ? 0 : imo_handikap2;
                }

                var imo_cs10cls = "";
                var imo_cs12cls = "";
                var imo_cs02cls = "";

                if (imo_cs10 != "-")
                    imo_cs10str = '<td align=center style="padding-right:2px;" class=' + imo_cs10cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Çifte Şans', "['1/X','1/2','X/2']", "['" + imo_cs10 + "','" + imo_cs12 + "','" + imo_cs02 + "']",eventId, matchData[52], "['1','2','3']", imo_cs10) + '</td>';
                else
                    imo_cs10str = '<td align=center>-</td>';

                if (imo_cs12 != "-")
                    imo_cs12str = '<td align=center style="padding-right:2px;" class=' + imo_cs12cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Çifte Şans', "['1/X','1/2','X/2']", "['" + imo_cs10 + "','" + imo_cs12 + "','" + imo_cs02 + "']",eventId, matchData[52], "['1','2','3']", imo_cs12) + '</td>';
                else
                    imo_cs12str = '<td align=center>-</td>';

                if (imo_cs02 != "-")
                    imo_cs02str = '<td align=center style="padding-right:2px;" class=' + imo_cs02cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Çifte Şans', "['1/X','1/2','X/2']", "['" + imo_cs10 + "','" + imo_cs12 + "','" + imo_cs02 + "']",eventId, matchData[52], "['1','2','3']", imo_cs02) + '</td>';
                else
                    imo_cs02str = '<td align=center>-</td>';

                var imo_alti = matchData[22];
                var imo_ustu = matchData[23];
                var imo_altistr, imo_ustustr;

                var imo_alticls = "";
                var imo_ustucls = "";

                if (imo_alti != "-" && imo_alti != "0")
                    imo_altistr = '<td align=center class=' + imo_alticls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '2,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti + "','" + imo_ustu + "']",eventId, matchData[53], "['1','2']", imo_alti) + '</td>';
                else
                    imo_altistr = '<td align=center>-</td>';

                if (imo_ustu != "-" && imo_alti != "0")
                    imo_ustustr = '<td align=center class=' + imo_ustucls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '2,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti + "','" + imo_ustu + "']",eventId, matchData[53], "['1','2']", imo_ustu) + '</td>';
                else
                    imo_ustustr = '<td align=center>-</td>';


                var imo_altiIY15 = matchData[42];
                var imo_ustuIY15 = matchData[43];
                var imo_altistrIY15, imo_ustustrIY15;

                if (imo_altiIY15 != "-" && imo_altiIY15 != "0")
                    imo_altistrIY15 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'İlk Yarı 1,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_altiIY15 + "','" + imo_ustuIY15 + "']",eventId, matchData[60], "['1','2']", imo_altiIY15) + '</td>';
                else
                    imo_altistrIY15 = '<td align=center>-</td>';

                if (imo_ustuIY15 != "-" && imo_ustuIY15 != "0")
                    imo_ustustrIY15 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'İlk Yarı 1,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_altiIY15 + "','" + imo_ustuIY15 + "']",eventId, matchData[60], "['1','2']", imo_ustuIY15) + '</td>';
                else
                    imo_ustustrIY15 = '<td align=center>-</td>';


                var imo_alti15 = matchData[44];
                var imo_ustu15 = matchData[45];
                var imo_altistr15, imo_ustustr15;

                if (imo_alti15 != "-" && imo_alti15 != "0")
                    imo_altistr15 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '1,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti15 + "','" + imo_ustu15 + "']",eventId, matchData[58], "['1','2']", imo_alti15) + '</td>';
                else
                    imo_altistr15 = '<td align=center>-</td>';

                if (imo_ustu15 != "-" && imo_alti15 != "0")
                    imo_ustustr15 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '1,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti15 + "','" + imo_ustu15 + "']",eventId, matchData[58], "['1','2']", imo_ustu15) + '</td>';
                else
                    imo_ustustr15 = '<td align=center>-</td>';

                var imo_alti35 = matchData[46];
                var imo_ustu35 = matchData[47];
                var imo_altistr35, imo_ustustr35;

                if (imo_alti35 != "-" && imo_alti35 != "0")
                    imo_altistr35 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '3,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti35 + "','" + imo_ustu35 + "']",eventId, matchData[59], "['1','2']", imo_alti35) + '</td>';
                else
                    imo_altistr35 = '<td align=center>-</td>';

                if (imo_ustu35 != "-" && imo_ustu35 != "0")
                    imo_ustustr35 = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, '3,5 Gol Alt/Üst', "['Alt','Üst']", "['" + imo_alti35 + "','" + imo_ustu35 + "']",eventId, matchData[59], "['1','2']", imo_ustu35) + '</td>';
                else
                    imo_ustustr35 = '<td align=center>-</td>';


                var tahminId = matchData[24];
                var tahminstr = "&nbsp;";

                var imo_handikap1style = imo_handikap1 == '' ? '' : 'style="color:#FF4040;"';
                var imo_handikap2style = imo_handikap2 == '' ? '' : 'style="color:#FF4040;"';

                var imohandikap1_str = '<td align=center ' + imo_handikap1style + '><b>' + imo_handikap1 + '&nbsp;</b></td>';
                var imohandikap2_str = '<td align=center ' + imo_handikap2style + '><b>' + imo_handikap2 + '&nbsp;</b></td>';

                if (imo_hms1 == '-' && (imo_handikap1 != '' || imo_handikap2 != '')) {
                    imohandikap1_str = imohandikap2_str = '<td></td>';
                }

                var altGrupAd10 = matchData[26];
                var grupId = matchData[27];
                var altGrId = matchData[28];

                var imo_gol01 = matchData[29];
                var imo_gol23 = matchData[30];
                var imo_gol46 = matchData[31];
                var imo_gol7 = matchData[32];
                var imo_iy1 = matchData[33] > "0" ? matchData[33] : "-";
                var imo_iyX = matchData[34] > "0" ? matchData[34] : "-";
                var imo_iy2 = matchData[35] > "0" ? matchData[35] : "-";

                var imo_iy1cls = ""
                var imo_iy1td = '<td align=center ' + imo_iy1cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'İlk Yarı Sonucu', "['1','X','2']", "['" + imo_iy1 + "','" + imo_iyX + "','" + imo_iy2 + "']",eventId, matchData[54], "['1','2','3']", imo_iy1) + '</td>';
                var imo_iyXcls = ""
                var imo_iyXtd = '<td align=center ' + imo_iyXcls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'İlk Yarı Sonucu', "['1','X','2']", "['" + imo_iy1 + "','" + imo_iyX + "','" + imo_iy2 + "']",eventId, matchData[54], "['1','2','3']", imo_iyX) + '</td>';
                var imo_iy2cls = ""
                var imo_iy2td = '<td align=center ' + imo_iy2cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'İlk Yarı Sonucu', "['1','X','2']", "['" + imo_iy1 + "','" + imo_iyX + "','" + imo_iy2 + "']",eventId, matchData[54], "['1','2','3']", imo_iy2) + '</td>';

                var imo_gol01cls = "";
                var imo_gol23cls = "";
                var imo_gol46cls = "";
                var imo_gol7cls = "";

                if (imo_gol01 > "0")
                    imo_gol01td = '<td align=center style="padding-right:2px;"' + imo_gol01cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Toplam Gol', "['0-1','2-3','4-6','7+']", "['" + imo_gol01 + "','" + imo_gol23 + "','" + imo_gol46 + "','" + imo_gol7 + "']",eventId, matchData[55], "['1','2','3','4']", imo_gol01) + '</td>';
                else
                    imo_gol01td = '<td align=center>-</td>';

                if (imo_gol23 > "0")
                    imo_gol23td = '<td align=center style="padding-right:2px;"' + imo_gol23cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Toplam Gol', "['0-1','2-3','4-6','7+']", "['" + imo_gol01 + "','" + imo_gol23 + "','" + imo_gol46 + "','" + imo_gol7 + "']",eventId, matchData[55], "['1','2','3','4']", imo_gol23) + '</td>';
                else
                    imo_gol23td = '<td align=center>-</td>';

                if (imo_gol46 > "0")
                    imo_gol46td = '<td align=center style="padding-right:2px;"' + imo_gol46cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Toplam Gol', "['0-1','2-3','4-6','7+']", "['" + imo_gol01 + "','" + imo_gol23 + "','" + imo_gol46 + "','" + imo_gol7 + "']",eventId, matchData[55], "['1','2','3','4']", imo_gol46) + '</td>';
                else
                    imo_gol46td = '<td align=center>-</td>';

                if (imo_gol7 > "0")
                    imo_gol7td = '<td align=center style="padding-right:2px;"' + imo_gol7cls + '>' + Mackolik.Coupon.prepareAddCouponLink2(imo_minmatchint, 'Toplam Gol', "['0-1','2-3','4-6','7+']", "['" + imo_gol01 + "','" + imo_gol23 + "','" + imo_gol46 + "','" + imo_gol7 + "']",eventId, matchData[55], "['1','2','3','4']", imo_gol7) + '</td>';
                else
                    imo_gol7td = '<td align=center>-</td>';

                if (matchDetail.tId) {
                    tahminstr = "<a href='" + Mackolik.UrlHelper.CreateTahminURL(match_id, matchData[1] + "-" + matchData[3]) + "' target='_blank' title='İddaa tahmini'><img src='" + ICON_PATH + "tahmin-ikon.gif'></a>";
                }

                //                                  0         1      2         3          4         5      6       7        8       9     10       11       12     13      14     15      16           17           18           19           20             21               22              23         24           25        26       27          28        29       30         31       32           33         34         35            36           37          38           39           40           41             42                43                 44             45             46              47            48            49       50
                sbScores.appendFormat(rowFormat, classname, saat, match_id, iddaId, imo_minmatch, flag1, bold1, takim1Id, takim1, bold2, bold3, takim2Id, takim2, bold4, htsonuc, ms, imo_cs10str, imo_cs12str, imo_cs02str, imo_altistr, imo_ustustr, imohandikap1_str, imohandikap2_str, imo_ms1str, imo_ms0str, imo_ms2str, flag2, tahminstr, altGrupAd10, grupId, altGrId, imo_iy1td, imo_iyXtd, imo_iy2td, imo_gol01td, imo_gol23td, imo_gol46td, imo_gol7td, imo_hms1str, imo_hms0str, imo_hms2str, imo_kg_varstr, imo_kg_yokstr, imo_altistrIY15, imo_ustustrIY15, imo_altistr15, imo_ustustr15, imo_altistr35, imo_ustustr35, altgeleme, sezonid);
                //'{23}{24}{25}{31}{32}{33}{21}{38}{39}{40}{22}{41}{42}{16}{17}{18}{43}{44}{45}{46}{19}{20}{47}{48}{34}{35}{36}{37}';
            }
        }
        document.getElementById("dvLarge").innerHTML = sbScores;
        headerAlign();
    },
    getComboData: function () {
        var url = APP_ROOT + '/AjaxHandlers/ProgramComboHandler.ashx?sport=' + Mackolik.Program.sport + '&type=' + Mackolik.Program.type + '&sortValue=' + Mackolik.Program.sortValue + '&week=' + Mackolik.Program.week + '&day=' + Mackolik.Program.day + '&sortDir=' + Mackolik.Program.sortDir + '&groupId=' + Mackolik.Program.groupId + "&np=" + Mackolik.Program.notPlayed;
        $.ajax({ url: url, success: Mackolik.Program.Large.getComboDataCompleted });
    },

    getComboDataCompleted: function (data) {
        data = eval("(" + data + ")");
        //Mackolik.Program.Large.fillCombo(document.getElementById("weekId"), data.w);
        Mackolik.Program.Large.fillCombo(document.getElementById("dayId"), data.d);
        Mackolik.Program.Large.fillCombo(document.getElementById("groupId"), data.l);
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
    sortRatio: function (sort, sortDir) {
        Mackolik.Program.sort = sort;
        Mackolik.Program.sortDir = sortDir;
        this.getProgram();
    },

    writeBasketballProgramByDate: function (livedata) {

        var dateFormat = '<tr class="groupHeader" height=15><td colspan=9></td><td colspan=4 align="center" style="background-color:#59a113;color:#FFFFFF;font-weight:bold;font-size:10px">Maç Sonucu</td><td colspan=4 align="center" style="background-color:#2EB8BE;color:#FFFFFF;font-weight:bold;font-size:10px">İlk Yarı Sonucu</td><td colspan=3 align="center" style="background-color:#8E8E8E;color:#FFFFFF;font-weight:bold;font-size:10px">Alt Üst</td><td colspan=4 align="center" style="background-color:#be0000;color:#FFFFFF;font-weight:bold;font-size:10px">İlk Yarı/Maç Sonucu</td></tr>';
        var dateFormat = dateFormat + '<tr class="groupHeader dateHeader" height=15><td width="45" style="text-align:left"><b>Saat{16}</b></td><td width="40" style="text-align:left"><b>Lig{17}</b></td><td width="19"><b>&nbsp;</b></td><td width="30" style="text-align:left"><b>Kod</b></td><td width="30"><b>MBS</b></td><td width="70" style="text-align:left"><b>Ev Sahibi</b></td><td width="70" style="text-align:left"><b>Misafir</b></td><td align="center" width="35"><b>IY</b></td> <td align="center" width="35"><b>MS</b></td> <td align="center" style="width: 35px;">{0}</td><td align="center" style="width: 35px;"><b>{1}</b></td><td align="center" style="width: 35px;">{2}</td><td align="center" style="width: 35px;">{3}</td><td align="center" style="width: 35px;"><b>{4}</b></td><td align="center" style="width: 35px;">{5}</td><td width="18"><b>h</b></td><td align="center" style="width: 35px;">{6}</td><td align="center" style="width: 35px;"><b>{7}</b></td><td align="center" style="width: 35px;">{8}</td><td width="15"><b>h</b></td><td align="center" style="width: 40px;">{9}</td><td align="center" style="width: 40px;">{10}</td><td align="center" style="width: 40px;"><b>{11}</b></td><td align="center" style="width: 35px;">{12}</td><td align="center" style="width: 35px;">{13}</td><td align="center" style="width: 35px;">{14}</td><td align="center" style="width: 35px;">{15}</td></tr>';
        var dateFormat2 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td></tr>';
        var dateFormat3 = '<tr class="groupHeader dateHeader" height=15><td width="30" colspan="2" style="padding-left:10px;text-align:left"><b>{0}</b></td><td></td><td style="text-align:left">Kod</td><td style="text-align:left">MBS</td><td style="text-align:left">Ev Sahibi</td><td style="text-align:left">Misafir</td><td style="text-align:center">IY</td><td style="text-align:center">MS</td><td style="text-align:center">H</td><td style="text-align:center">1</td><td style="text-align:center">2</td><td style="text-align:center">H</td><td style="text-align:center">H</td><td style="text-align:center">1</td><td style="text-align:left">2</td><td style="text-align:center">H</td><td style="text-align:center">Alt</td><td style="text-align:center">Üst</td><td style="text-align:left">TS</td><td style="text-align:center">1/1</td><td style="text-align:center">1/2</td><td style="text-align:center">2/1</td><td style="text-align:center">2/2</td></tr>';

        var sort = Mackolik.Program.sort;
        var bSort = (sort != 1 && sort != 2 && sort != 3);
        var sortSpan1 = bSort ? '<span style="color:#000066"><b>1</b></span>' : '<span><b>1</b></span>';
        var sortSpan2 = bSort ? '<span style="color:#000066"><b>2</b></span>' : '<span><b>2</b></span>';

        var sortSpanIY1 = bSort ? '<span style="color:#000066"><b>1</b></span>' : '<span><b>1</b></span>';
        var sortSpanIY2 = bSort ? '<span style="color:#000066"><b>2</b></span>' : '<span><b>2</b></span>';

        var sortSpanA = bSort ? '<span style="color:#000066"><b>A</b></span>' : '<span><b>A</b></span>';
        var sortSpanU = bSort ? '<span style="color:#000066"><b>U</b></span>' : '<span><b>U</b></span>';

        var sortSpanIM11 = bSort ? '<span style="color:#000066"><b>1/1</b></span>' : '<span><b>1/1</b></span>';
        var sortSpanIM12 = bSort ? '<span style="color:#000066"><b>1/2</b></span>' : '<span><b>1/2</b></span>';
        var sortSpanIM21 = bSort ? '<span style="color:#000066"><b>2/1</b></span>' : '<span><b>2/1</b></span>';
        var sortSpanIM22 = bSort ? '<span style="color:#000066"><b>2/2</b></span>' : '<span><b>2/2</b></span>';

        var sortSpanS = '', sortSpanL = '';

        sortSpan1 = Mackolik.Program.sort == 1 && Mackolik.Program.sortDir == 1 ? sortSpan1 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan1 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(1,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan1 = Mackolik.Program.sort == 1 && Mackolik.Program.sortDir == 2 ? sortSpan1 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan1 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(1,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpan2 = Mackolik.Program.sort == 3 && Mackolik.Program.sortDir == 1 ? sortSpan2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpan2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(3,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpan2 = Mackolik.Program.sort == 3 && Mackolik.Program.sortDir == 2 ? sortSpan2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpan2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(3,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanIY1 = Mackolik.Program.sort == 9 && Mackolik.Program.sortDir == 1 ? sortSpanIY1 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIY1 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(9,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIY1 = Mackolik.Program.sort == 9 && Mackolik.Program.sortDir == 2 ? sortSpanIY1 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIY1 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(9,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIY2 = Mackolik.Program.sort == 11 && Mackolik.Program.sortDir == 1 ? sortSpanIY2 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIY2 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(11,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIY2 = Mackolik.Program.sort == 11 && Mackolik.Program.sortDir == 2 ? sortSpanIY2 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIY2 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(11,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanA = Mackolik.Program.sort == 7 && Mackolik.Program.sortDir == 1 ? sortSpanA + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanA + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(7,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanA = Mackolik.Program.sort == 7 && Mackolik.Program.sortDir == 2 ? sortSpanA + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanA + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(7,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanU = Mackolik.Program.sort == 8 && Mackolik.Program.sortDir == 1 ? sortSpanU + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanU + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(8,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanU = Mackolik.Program.sort == 8 && Mackolik.Program.sortDir == 2 ? sortSpanU + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanU + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(8,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanS = Mackolik.Program.sort == 24 && Mackolik.Program.sortDir == 1 ? sortSpanS + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanS + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(24,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanS = Mackolik.Program.sort == 24 && Mackolik.Program.sortDir == 2 ? sortSpanS + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanS + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(24,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanL = Mackolik.Program.sort == 23 && Mackolik.Program.sortDir == 1 ? sortSpanL + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanL + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(23,1)" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanL = Mackolik.Program.sort == 23 && Mackolik.Program.sortDir == 2 ? sortSpanL + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanL + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(23,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        sortSpanIM11 = Mackolik.Program.sort == 12 && Mackolik.Program.sortDir == 1 ? sortSpanIM11 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIM11 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(12,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIM11 = Mackolik.Program.sort == 12 && Mackolik.Program.sortDir == 2 ? sortSpanIM11 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIM11 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(12,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIM12 = Mackolik.Program.sort == 13 && Mackolik.Program.sortDir == 1 ? sortSpanIM12 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIM12 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(13,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIM12 = Mackolik.Program.sort == 13 && Mackolik.Program.sortDir == 2 ? sortSpanIM12 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIM12 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(13,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIM21 = Mackolik.Program.sort == 14 && Mackolik.Program.sortDir == 1 ? sortSpanIM21 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIM21 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(14,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIM21 = Mackolik.Program.sort == 14 && Mackolik.Program.sortDir == 2 ? sortSpanIM21 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIM21 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(14,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';
        sortSpanIM22 = Mackolik.Program.sort == 15 && Mackolik.Program.sortDir == 1 ? sortSpanIM22 + '<img style="padding:0px;" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-orange-top.gif"/>' : sortSpanIM22 + '<img style="padding:0px;" onmouseover="addColor(this,1)" onmouseout="removeColor(this,1)" onclick="Mackolik.Program.Large.sortRatio(15,1);" width="9px" border="0" title="Artan Sırala" src="' + IMG_PATH + '/icons/sort-blue-top.gif" />';
        sortSpanIM22 = Mackolik.Program.sort == 15 && Mackolik.Program.sortDir == 2 ? sortSpanIM22 + '<img style="padding:0px;" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-orange-bottom.gif"/>' : sortSpanIM22 + '<img style="padding:0px;" onmouseover="addColor(this,2)" onmouseout="removeColor(this,2)" onclick="Mackolik.Program.Large.sortRatio(15,2)" width="9px" border="0" title="Azalan Sırala" src="' + IMG_PATH + '/icons/sort-blue-bottom.gif"/>';

        var rowFormat = '<tr onmouseover="HLon(this)" onmouseout="HLoff(this)" class="{0}"><td>{1}</td>';
        rowFormat = rowFormat + '<td align="left" style="padding:0px;border-right:none;">&nbsp;<a href="javascript:popBasketLeague({30})">{28}</a></td>'
        rowFormat = rowFormat + '<td><img src="' + GROUP_FLAG_PATH + '/{29}.gif"/></td>';
        rowFormat = rowFormat + '<td><a href="javascript:popBasketComparison({2})"><b>{3}</b></a></td>';
        rowFormat = rowFormat + '<td align=center> {4} &nbsp;</td>'
        rowFormat = rowFormat + '<td align=left>{6}<a href="javascript:popBasketTeam({7})">{8}</a>{9}</td>';
        rowFormat = rowFormat + '<td style="border-right:none" align=left>{10}<a href="javascript:popBasketTeam({11})">{12}</a> {13} </td>';
        rowFormat = rowFormat + '<td align=center>{14}</td><td align=center>{15} </td>';
        rowFormat = rowFormat + '{19}{20}{21}{22}{23}{24}{25}{26}{27}{28}{30}{16}{17}{18}';
        rowFormat = rowFormat + '<td align=center>{31}</td></tr>';

        var header = '<table style="width:100%;" border=0 cellpadding=0 cellspacing=0  id=resultsList style="border: 1px solid rgb(204, 204, 204);" class="iddaa-oyna-table"><tr height="1" class="groupHeader dateHeader"><td colspan="9"/><td width="1" rowspan="5000"></td> <td colspan="4"/> <td width="1" rowspan="5000"></td> <td colspan="4"/> <td width="1" rowspan="5000"></td> <td colspan="3"/> <td width="1" rowspan="5000"><td colspan="4"/></tr>';

        var sbScores = new StringBuilder();
        var dateData = livedata.m;

        sbScores.append(header);

        var k = 0;
        for (var j = 0; j < dateData.length; j++) {

            if (j == 0)
                sbScores.appendFormat(dateFormat, "", sortSpan1, sortSpan2, "", "", sortSpanIY1, sortSpanIY2, "", sortSpanA, sortSpanU, "", "", sortSpanIM11, sortSpanIM12, sortSpanIM21, sortSpanIM22, sortSpanS, sortSpanL);

            if (j == 0)
                sbScores.appendFormat(dateFormat2, dateData[j].d);
            else
                sbScores.appendFormat(dateFormat3, dateData[j].d);

            var data = dateData[j].m;

            if (data.length == 0)
                sbScores.append('<tr><td bgcolor=#CED7D2></td><td colspan=26 bgcolor=#CED7D2><b>Bu kriterlere uygun maç bulunamadi.</b></td></tr>');

            var weekStatus = true;
            if (Mackolik.Program.week != Mackolik.Program.currentWeek) {
                weekStatus = false;
            }

            for (var i = 0; i < data.length; i++, k++) {
                var matchData = data[i];
                var score = '';
                var match_status = '';
                var stadium_status = '&nbsp;';
                var classname = (k % 2) == 1 ? "alt1" : "alt2";
                var saat = matchData[1];
                var match_id = matchData[0];
                var iddaId = matchData[6];
                var matchDetail = { bh: "1", ba: "2", bhn: "bhn detay", ban: "ban detay" };

                //var imo_minmatch = matchData[13] == undefined ? "" : matchData[13];
                var imo_minmatchint = matchData[7] ? matchData[7] : "4";
                var imo_minmatch = "<img src='" + ICON_PATH + "mbs" + imo_minmatchint + ".gif'>";

                var flag1 = "&nbsp;"
                var flag2 = "&nbsp;"
                if (matchDetail.bh) {
                    flag1 = "<img src='" + SMALL_FLAG_PATH + matchDetail.bh + ".gif' title='" + matchDetail.bhn + "'>";
                }
                if (matchDetail.ba) {
                    flag2 = "<img src='" + SMALL_FLAG_PATH + matchDetail.ba + ".gif' title='" + matchDetail.ban + "'>";
                }
                var macSonuc1 = matchData[14];
                var macSonuc2 = matchData[15];
                var IYSonuc1 = matchData[12] != undefined ? matchData[12] : "";
                var IYSonuc2 = matchData[13] != undefined ? matchData[13] : "";
                var macDurum = matchData[29];
                var takim1 = matchData[17];
                var takim1Id = matchData[18];
                var takim2 = matchData[19];
                var takim2Id = matchData[20];
                var imo_handikap1 = matchData[10] == undefined ? '' : matchData[10];
                var imo_handikap2 = matchData[11] == undefined ? '' : matchData[11];
                var imo_hthandikap1 = matchData[8] == undefined ? '' : matchData[8];
                var imo_hthandikap2 = matchData[9] == undefined ? '' : matchData[9];
                var imo_ts = matchData[30];

                var bold1 = (macSonuc1 > macSonuc2) && macDurum >= 4 ? "<b>" : "";
                var bold2 = (macSonuc1 > macSonuc2) && macDurum >= 4 ? "</b>" : "";

                var bold3 = (macSonuc1 < macSonuc2) && macDurum >= 4 ? "<b>" : "";
                var bold4 = (macSonuc1 < macSonuc2) && macDurum >= 4 ? "</b>" : "";

                var htsonuc;
                if (macDurum == 21 || macDurum == 23) {
                    htsonuc = 'ERT';
                } else if (macDurum == 22) {
                    htsonuc = 'Yrdk.';
                } else {
                    htsonuc = macDurum >= 13 ? IYSonuc1 + ' - ' + IYSonuc2 : '&nbsp;';
                }

                var ms;

                if (macDurum < 13) {
                    ms = '<a href=\"javascript:popBasketMatch(' + match_id + ')\">v</a>';
                } else {
                    if (macDurum == 21 || macDurum == 23) {
                        ms = '<b><a href=\"javascript:popBasketMatch(' + match_id + ')\">ERT.</a></b>';
                    } else if (macDurum == 22) {
                        ms = '<b><a href=\"javascript:popBasketMatch(' + match_id + ')\">Yrdk.</a></b>';
                    } else {
                        ms = '<b><a href=\"javascript:popBasketMatch(' + match_id + ')\">' + macSonuc1 + ' - ' + macSonuc2 + '</a></b>';
                    }
                }

                var imo_ms1 = "1.7";
                var imo_ms2 = "1.7";
                var imo_ms1str, imo_ms2str;

                if (imo_ms1 != "-")
                    imo_ms1str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_ms1, 'MS', '1', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_ms1str = '<td align=center>-</td>';

                if (imo_ms2 != "-")
                    imo_ms2str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_ms2, 'MS', '2', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_ms2str = '<td align=center>-</td>';

                var imo_iy1 = "1.7";
                var imo_iy2 = "1.7";

                var imo_iy1cls = ""
                var imo_iy1td = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iy1, 'IY', '1', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                var imo_iy2cls = ""
                var imo_iy2td = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iy2, 'IY', '2', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';


                var imo_alti = "1.7";
                var imo_ustu = "1.7";
                var imo_altistr, imo_ustustr;

                if (imo_alti != "-" && imo_alti != "0")
                    imo_altistr = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_alti, 'AU', '1', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_altistr = '<td align=center>-</td>';

                if (imo_ustu != "-" && imo_alti != "0")
                    imo_ustustr = '<td align=center>' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_ustu, 'AU', '2', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_ustustr = '<td align=center>-</td>';


                var imo_iyms11 = matchData[22];
                var imo_iyms12 = matchData[23];
                var imo_iyms21 = matchData[24];
                var imo_iyms22 = matchData[25];

                var imo_iyms11str, imo_iyms12str, imo_iyms21str, imo_iyms22str;

                if (imo_iyms11 != "-")
                    imo_iyms11Str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iyms11, 'IM', '1/1', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_iyms11Str = '<td align=center>-</td>';

                if (imo_iyms12 != "-")
                    imo_iyms12Str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iyms12, 'IM', '1/2', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_iyms12Str = '<td align=center>-</td>';

                if (imo_iyms21 != "-")
                    imo_iyms21Str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iyms21, 'IM', '2/1', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_iyms21Str = '<td align=center>-</td>';

                if (imo_iyms22 != "-")
                    imo_iyms22Str = '<td align=center style="padding-right:2px;">' + Mackolik.Coupon.prepareAddCouponLink(iddaId, imo_iyms22, 'IM', '2/2', takim1, takim2, match_id, takim1Id, takim2Id, imo_minmatchint, imo_handikap1, imo_handikap2, imo_hthandikap1, imo_hthandikap2, weekStatus ? macDurum : -1, 'iddaa-rate', 1, IYSonuc1, IYSonuc2, macSonuc1, macSonuc2, imo_ts, 1) + '</td>';
                else
                    imo_iyms22Str = '<td align=center>-</td>';


                var imo_handikap1style = imo_handikap1 == '' ? '' : 'style="color:#FF4040;"';
                var imo_handikap2style = imo_handikap2 == '' ? '' : 'style="color:#FF4040;"';

                var imohandikap1_str = '<td align=center ' + imo_handikap1style + '><b>' + imo_handikap1 + '&nbsp;</b></td>';
                var imohandikap2_str = '<td align=center ' + imo_handikap2style + '><b>' + imo_handikap2 + '&nbsp;</b></td>';

                var imo_hthandikap1style = imo_hthandikap1 == '' ? '' : 'style="color:#FF4040;"';
                var imo_hthandikap2style = imo_hthandikap2 == '' ? '' : 'style="color:#FF4040;"';

                var imohthandikap1_str = '<td align=center ' + imo_hthandikap1style + '><b>' + imo_hthandikap1 + '&nbsp;</b></td>';
                var imohthandikap2_str = '<td align=center ' + imo_hthandikap2style + '><b>' + imo_hthandikap2 + '&nbsp;</b></td>';

                var altGrupAd10 = matchData[4];
                var grupId = matchData[5];
                var altGrId = matchData[2];

                //                                  0         1      2         3          4         5      6       7        8       9     10       11       12     13      14     15      16                17           18          19                   20             21      22           23               24        25      26        27          28           29        30         31
                sbScores.appendFormat(rowFormat, classname, saat, match_id, iddaId, imo_minmatch, flag1, bold1, takim1Id, takim1, bold2, bold3, takim2Id, takim2, bold4, htsonuc, ms, imohandikap1_str, imo_ms1str, imo_ms2str, imohandikap2_str, imohthandikap1_str, imo_iy1, imo_iy2, imohthandikap2_str, imo_alti, imo_ustu, imo_ts, imo_iyms11, imo_iyms12, imo_iyms21, imo_iyms22, grupId);
            }
        }
        document.getElementById("dvLarge").innerHTML = sbScores;
        headerAlign();
    }

}
