import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Scrollbars from "react-custom-scrollbars-2";
import ImageWithBasePath from "../imageWithBasePath";
import "../../../style/icon/tabler-icons/webfont/tabler-icons.css";
import { setExpandMenu } from "../../data/redux/sidebarSlice";
import { useDispatch, useSelector } from "react-redux";
import {
  resetAllMode,
  setDataLayout,
} from "../../data/redux/themeSettingSlice";
import usePreviousRoute from "./usePreviousRoute";
import { SidebarDataTest } from "../../data/json/sidebarMenu";
import { searchCompanies } from "../../../services/searchService";
import "../header/search.css";
import { useAuth } from "../../../contexts/AuthContext";

const Sidebar = () => {
  const Location = useLocation();
  const { user } = useAuth();
  const [subOpen, setSubOpen] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Handle search input changes
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length >= 2) {
      setIsSearching(true);
      try {
        const response = await searchCompanies(value);
        if (response.success) {
          setSearchResults(response.data);
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search result click
  const handleSearchResultClick = (companyId: string) => {
    setShowSearchResults(false);
    setSearchTerm("");
    // Navigate to company detail page
    window.location.href = `/company-detail-dashboard/${companyId}`;
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleSidebar = (title: any) => {
    localStorage.setItem("menuOpened", title);
    if (subOpen === title) {
      setSubOpen("");
    } else {
      setSubOpen(title);
    }
  };

  const toggleSubsidebar = (subitem: any) => {
    if (subitem === subOpen) {
      setSubOpen("");
    } else {
      setSubOpen(subitem);
    }
  };

  const handleLayoutChange = (layout: string) => {
    dispatch(setDataLayout(layout));
  };

  const handleClick = (label: any, themeSetting: any, layout: any) => {
    if (themeSetting) {
      dispatch(setDataLayout(themeSetting));
    }
    if (layout) {
      handleLayoutChange(layout);
    }
  };

  const handleTitleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    title: any
  ) => {
    if (title?.submenu) {
      e.preventDefault();
      toggleSidebar(title?.label);
      return;
    }

    handleClick(
      title?.label,
      title?.themeSetting,
      getLayoutClass(title?.label)
    );
  };

  const getLayoutClass = (label: any) => {
    if (label === "Horizontal") {
      return "horizontal-layout";
    } else if (label === "Vertical") {
      return "vertical-layout";
    } else if (label === "Two Column") {
      return "two-column-layout";
    } else if (label === "Stacked") {
      return "stacked-layout";
    }
    return "";
  };

  const dispatch = useDispatch();
  const dataLayout = useSelector((state: any) => state.themeSetting.dataLayout);
  const mobileSidebar = useSelector((state: any) => state.sidebarSlice.mobileSidebar);
  const isStartupSession = user?.role === "STARTUP";
  const isExpertSession = user?.role === "EXPERT";

  const startupFilteredSidebarData = isStartupSession
    ? SidebarDataTest.map((section: any) => ({
        ...section,
        submenuItems: (section?.submenuItems || []).map((item: any) =>
          item?.label === "Dashboard"
            ? {
                ...item,
                submenuItems: (item?.submenuItems || []).filter((sub: any) =>
                  ["Startup Dashboard", "Indicateurs S2T"].includes(sub?.label)
                ),
              }
            : item
        ),
      }))
    : SidebarDataTest;

  const visibleSidebarData = startupFilteredSidebarData.map((section: any) => {
    const mappedItems = (section?.submenuItems || []).map((item: any) =>
      item?.label === "Applications" && !isExpertSession
        ? {
            ...item,
            submenuItems: (item?.submenuItems || []).filter(
              (sub: any) => sub?.base !== "notes" && sub?.label !== "Notes"
            ),
          }
        : item
    );

    const roleFilteredItems = mappedItems.filter((item: any) =>
      item?.label === "Experts" ? isStartupSession : true
    );

    return {
      ...section,
      submenuItems: roleFilteredItems,
    };
  });

  const onMouseEnter = () => {
    document.body.classList.add("sidebar-hovered");
  };

  const onMouseLeave = () => {
    document.body.classList.remove("sidebar-hovered");
  };

  useEffect(() => {
    const layoutPages = [
      "/layout-dark",
      "/layout-rtl",
      "/layout-mini",
      "/layout-box",
      "/layout-default",
    ];

    const isCurrentLayoutPage = layoutPages.some((path) =>
      Location.pathname.includes(path)
    );
    const isPreviousLayoutPage =
      Location.pathname &&
      layoutPages.some((path) => Location.pathname.includes(path));


  }, [Location.pathname]);

  useEffect(() => {
    const currentMenu = localStorage.getItem("menuOpened") || 'Dashboard'
    setSubOpen(currentMenu);
    // Select all 'submenu' elements
    const submenus = document.querySelectorAll(".submenu");
    // Loop through each 'submenu'
    submenus.forEach((submenu) => {
      // Find all 'li' elements within the 'submenu'
      const listItems = submenu.querySelectorAll("li");
      submenu.classList.remove("active");
      // Check if any 'li' has the 'active' class
      listItems.forEach((item) => {
        if (item.classList.contains("active")) {
          // Add 'active' class to the 'submenu'
          submenu.classList.add("active");
          return;
        }
      });
    });
  }, [Location.pathname]);

  return (
    <>
      <div
        className="sidebar"
        id="sidebar"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
  <div className="sidebar-logo">
    <Link to="routes.index" className="logo logo-normal">
      <ImageWithBasePath src="assets/img/logo.svg" alt="Logo" />
    </Link>
    <Link to="routes.index" className="logo-small">
      <ImageWithBasePath src="assets/img/logo-small.svg" alt="Logo" />
    </Link>
    <Link to="routes.index" className="dark-logo">
      <ImageWithBasePath src="assets/img/logo-white.svg" alt="Logo" />
    </Link>
  </div>
  <div className="modern-profile p-3 pb-0">
    <div className="text-center rounded bg-light p-3 mb-4 user-profile">
      <div className="avatar avatar-lg online mb-3">
        <ImageWithBasePath
          src="assets/img/profiles/avatar-02.jpg"
          alt="Img"
          className="img-fluid rounded-circle"
        />
      </div>
      <h6 className="fs-12 fw-normal mb-1">Adrian Herman</h6>
      <p className="fs-10">System Admin</p>
    </div>
    <div className="sidebar-nav mb-3">
      <ul
        className="nav nav-tabs nav-tabs-solid nav-tabs-rounded nav-justified bg-transparent"
        role="tablist"
      >
        <li className="nav-item">
          <Link className="nav-link active border-0" to="#">Menu</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link border-0" to="#">Chats</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link border-0" to="#">Inbox</Link>
        </li>
      </ul>
    </div>
  </div>
  <div className="sidebar-header p-3 pb-0 pt-2">
    <div
      className="text-center rounded bg-light p-2 mb-4 sidebar-profile d-flex align-items-center"
    >
      <div className="avatar avatar-md onlin">
        <ImageWithBasePath
          src="assets/img/profiles/avatar-02.jpg"
          alt="Img"
          className="img-fluid rounded-circle"
        />
      </div>
      <div className="text-start sidebar-profile-info ms-2">
        <h6 className="fs-12 fw-normal mb-1">Adrian Herman</h6>
        <p className="fs-10">System Admin</p>
      </div>
    </div>
    <div className="input-group input-group-flat d-inline-flex mb-4 position-relative" ref={searchRef}>
      <span className="input-icon-addon">
        <i className="ti ti-search"></i>
      </span>
      <input 
        type="text" 
        className="form-control" 
        placeholder="Search companies by name or domain..." 
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
      />
      <span className="input-group-text">
        <kbd>CTRL + / </kbd>
      </span>
      
      {/* Search Results Dropdown */}
      {showSearchResults && (
        <div className="search-results-dropdown">
          <div className="search-results-header">
            <h6 className="mb-0">Search Results</h6>
            {isSearching && <small className="text-muted">Searching...</small>}
          </div>
          <div className="search-results-body">
            {searchResults.length > 0 ? (
              searchResults.map((company, index) => (
                <div 
                  key={index} 
                  className="search-result-item"
                  onClick={() => handleSearchResultClick(company._id)}
                >
                  <div className="search-result-content">
                    <div className="company-name">{company.companyName}</div>
                    <div className="company-details">
                      <span className="founder">{company.founderName}</span>
                      <span className="domain">{company.activityDomain}</span>
                      <span className={`status badge bg-${company.requestStatus === 'APPROVED' ? 'success' : company.requestStatus === 'REJECTED' ? 'danger' : 'warning'}`}>
                        {company.requestStatus}
                      </span>
                    </div>
                  </div>
                  <i className="ti ti-arrow-right"></i>
                </div>
              ))
            ) : (
              <div className="no-results">
                <i className="ti ti-search"></i>
                <p>No companies found</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    <div
      className="d-flex align-items-center justify-content-between menu-item mb-3"
    >
      <div className="me-3">
        <Link to="#" className="btn btn-menubar position-relative">
          <i className="ti ti-shopping-bag"></i>
          <span className="badge bg-success rounded-pill d-flex align-items-center justify-content-center header-badge"
            >5</span>
        </Link>
      </div>
      <div className="me-3">
        <Link to="#" className="btn btn-menubar">
          <i className="ti ti-layout-grid-remove"></i>
        </Link>
      </div>
      <div className="me-3">
        <Link to="#" className="btn btn-menubar position-relative">
          <i className="ti ti-brand-hipchat"></i>
          <span
            className="badge bg-info rounded-pill d-flex align-items-center justify-content-center header-badge"
            >5</span>
        </Link>
      </div>
      <div className="me-3 notification-item">
        <Link to="#" className="btn btn-menubar position-relative me-1">
          <i className="ti ti-bell"></i>
          <span className="notification-status-dot"></span>
        </Link>
      </div>
      <div className="me-0">
        <Link to="#" className="btn btn-menubar">
          <i className="ti ti-message"></i>
        </Link>
      </div>
    </div>
  </div>
        <Scrollbars>
          <div className="sidebar-inner slimscroll">
            <div id="sidebar-menu" className="sidebar-menu">
              <ul>
              {visibleSidebarData?.map((mainLabel: any, index: number) => (
                <React.Fragment key={`main-${index}`}>
                    <li className="menu-title">
                        <span>{mainLabel?.tittle}</span>
                    </li>
                    <li>
                    <ul>
                        {mainLabel?.submenuItems?.map((title: any, i: number) => {
                        let link_array: any = [];
                        if ("submenuItems" in title) {
                            title.submenuItems?.forEach((link: any) => {
                            link_array.push(link?.link);
                            if (link?.submenu && "submenuItems" in link) {
                                link.submenuItems?.forEach((item: any) => {
                                link_array.push(item?.link);
                                });
                            }
                            });
                        }
                        title.links = link_array;

                        return (
                            <li className="submenu" key={`title-${i}`}>
                            <Link
                                to={title?.submenu ? "#" : title?.link}
                                onClick={(e) => handleTitleClick(e, title)}
                                className={`${
                                subOpen === title?.label ? "subdrop" : ""
                                } ${
                                title?.links?.includes(Location.pathname) ? "active" : ""
                                } ${
                                title?.submenuItems
                                    ?.map((link: any) => link?.link)
                                    .includes(Location.pathname) ||
                                title?.link === Location.pathname
                                    ? "active"
                                    : ""
                                }`}
                            >
                                <i className={`ti ti-${title.icon}`}></i>
                                <span>{title?.label}</span>
                                {title?.dot && (
                                <span className="badge badge-danger fs-10 fw-medium text-white p-1">
                                    Hot
                                </span>
                                )}
                                <span className={title?.submenu ? "menu-arrow" : ""} />
                            </Link>
                            {title?.submenu !== false && subOpen === title?.label && (
                                <ul
                                style={{
                                    display: subOpen === title?.label ? "block" : "none",
                                }}
                                >
                                {title?.submenuItems?.map((item: any, j: any) => (
                                    <li
                                    className={
                                        item?.submenuItems ? "submenu submenu-two" : ""
                                    }
                                    key={`item-${j}`}
                                    >
                                    <Link
                                        to={ item?.submenu ? "#" :item?.link}
                                        className={`${
                                        item?.submenuItems
                                            ?.map((link: any) => link?.link)
                                            .includes(Location.pathname) ||
                                        item?.link === Location.pathname
                                            ? "active"
                                            : ""
                                        } ${
                                        subOpen === item?.label ? "subdrop" : ""
                                        }`}
                                        onClick={() => {
                                        toggleSubsidebar(item?.label);
                                        }}
                                    >
                                        {item?.label}
                                        <span
                                        className={item?.submenu ? "menu-arrow" : ""}
                                        />
                                    </Link>
                                    {item?.submenuItems ? (
                                        <ul
                                        style={{
                                            display:
                                            subOpen === item?.label ? "block" : "none",
                                        }}
                                        >
                                        {item?.submenuItems?.map((items: any, k: any) => (
                                            <li key={`submenu-item-${k}`}>
                                            <Link
                                                to={items?.submenu ? "#" :items?.link}
                                                className={`${
                                                subOpen === items?.label
                                                    ? "submenu-two subdrop"
                                                    : "submenu-two"
                                                } ${
                                                items?.submenuItems
                                                    ?.map((link: any) => link.link)
                                                    .includes(Location.pathname) ||
                                                items?.link === Location.pathname
                                                    ? "active"
                                                    : ""
                                                }`}
                                            >
                                                {items?.label}
                                            </Link>
                                            </li>
                                        ))}
                                        </ul>
                                    ) : null}
                                    </li>
                                ))}
                                </ul>
                            )}
                            </li>
                        );
                        })}
                    </ul>
                    </li>
                </React.Fragment>
                ))}

              </ul>
            </div>
          </div>
        </Scrollbars>
      </div>
    </>
  );
};

export default Sidebar;
